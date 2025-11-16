from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import jwt
from passlib.context import CryptContext
import requests
from motor.motor_asyncio import AsyncIOMotorClient
import os

# ===============================
# CONFIGURATION
# ===============================

SECRET_KEY = "your-secret-key-change-this-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = "fitness_coach"

EXERCISEDB_API_KEY = os.getenv("EXERCISEDB_API_KEY", "your-rapidapi-key")
EXERCISEDB_HOST = "exercisedb.p.rapidapi.com"

USDA_API_KEY = os.getenv("USDA_API_KEY", "DEMO_KEY")
USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1"

# ===============================
# FASTAPI APP
# ===============================

app = FastAPI(title="AI Fitness Coach API", version="1.0.0")

# ===============================
# FIXED CORS CONFIGURATION
# ===============================

FRONTEND_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    # ⬇️ VERY IMPORTANT — REPLACE WITH YOUR EXACT VERCEL FRONTEND URL
    "https://ai-fitness-coach-omega-nine.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===============================
# AUTH / DATABASE SETUP
# ===============================

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

client = AsyncIOMotorClient(MONGODB_URL)
db = client[DATABASE_NAME]

users_collection = db.users
exercises_collection = db.exercises
foods_collection = db.foods
workouts_collection = db.workouts
nutrition_logs_collection = db.nutrition_logs
mental_health_collection = db.mental_health

# ===============================
# MODELS
# ===============================

class User(BaseModel):
    username: str
    password: str

class UserInDB(BaseModel):
    username: str
    hashed_password: str
    created_at: datetime
    age: Optional[int] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    goal: Optional[str] = None
    fitness_level: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class ExerciseSearch(BaseModel):
    query: Optional[str] = ""
    category: Optional[str] = "all"
    equipment: Optional[str] = "all"

class FoodSearch(BaseModel):
    query: str

class WorkoutSession(BaseModel):
    exercise_id: str
    exercise_name: str
    reps: int
    sets: int
    duration: int

class MoodLog(BaseModel):
    mood: str
    journal: Optional[str] = ""

class NutritionLog(BaseModel):
    food_id: str
    food_name: str
    calories: float
    protein: float
    carbs: float
    fat: float
    serving_size: str

# ===============================
# AUTH HELPERS
# ===============================

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    user = await users_collection.find_one({"username": username})
    if user is None:
        raise credentials_exception
    return user

# ===============================
# AUTH ROUTES
# ===============================

@app.post("/auth/signup", response_model=Token)
async def signup(user: User):
    existing_user = await users_collection.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")

    hashed_password = get_password_hash(user.password)
    user_dict = {
        "username": user.username,
        "hashed_password": hashed_password,
        "created_at": datetime.utcnow(),
        "age": None,
        "height": None,
        "weight": None,
        "goal": "maintenance",
        "fitness_level": "beginner",
    }

    await users_collection.insert_one(user_dict)
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/auth/login", response_model=Token)
async def login(user: User):
    db_user = await users_collection.find_one({"username": user.username})
    if not db_user or not verify_password(user.password, db_user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

# ===============================
# USER PROFILE ROUTES
# ===============================

@app.get("/users/me")
async def get_profile(current_user: dict = Depends(get_current_user)):
    return {
        "username": current_user["username"],
        "age": current_user.get("age"),
        "height": current_user.get("height"),
        "weight": current_user.get("weight"),
        "goal": current_user.get("goal"),
        "fitness_level": current_user.get("fitness_level"),
        "created_at": current_user.get("created_at"),
    }

@app.put("/users/me")
async def update_profile(
    age: Optional[int] = None,
    height: Optional[float] = None,
    weight: Optional[float] = None,
    goal: Optional[str] = None,
    fitness_level: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    update_data = {
        k: v for k, v in {
            "age": age,
            "height": height,
            "weight": weight,
            "goal": goal,
            "fitness_level": fitness_level,
        }.items() if v is not None
    }

    if update_data:
        await users_collection.update_one(
            {"username": current_user["username"]},
            {"$set": update_data},
        )

    return {"message": "Profile updated successfully"}

# ===============================
# HEALTH CHECK
# ===============================

@app.get("/")
async def root():
    return {"message": "AI Fitness Coach API", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

# ===============================
# SERVER MAIN
# ===============================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
