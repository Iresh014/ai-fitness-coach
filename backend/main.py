from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import jwt
from passlib.context import CryptContext
import requests
from motor.motor_asyncio import AsyncIOMotorClient
import os

# Configuration
SECRET_KEY = "your-secret-key-change-this-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = "fitness_coach"

# ExerciseDB API Configuration (Get free key from RapidAPI)
EXERCISEDB_API_KEY = os.getenv("EXERCISEDB_API_KEY", "your-rapidapi-key")
EXERCISEDB_HOST = "exercisedb.p.rapidapi.com"

# USDA FoodData API (Free, no key needed for basic use)
USDA_API_KEY = os.getenv("USDA_API_KEY", "DEMO_KEY")
USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1"

# Initialize FastAPI
app = FastAPI(title="AI Fitness Coach API", version="1.0.0")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# MongoDB connection
client = AsyncIOMotorClient(MONGODB_URL)
db = client[DATABASE_NAME]

# Collections
users_collection = db.users
exercises_collection = db.exercises
foods_collection = db.foods
workouts_collection = db.workouts
nutrition_logs_collection = db.nutrition_logs
mental_health_collection = db.mental_health

# Pydantic Models
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
    duration: int  # in seconds
    
class MoodLog(BaseModel):
    mood: str  # great, good, okay, low, stressed
    journal: Optional[str] = ""

class NutritionLog(BaseModel):
    food_id: str
    food_name: str
    calories: float
    protein: float
    carbs: float
    fat: float
    serving_size: str

# Helper Functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = await users_collection.find_one({"username": username})
    if user is None:
        raise credentials_exception
    return user

# Authentication Endpoints
@app.post("/auth/signup", response_model=Token)
async def signup(user: User):
    # Check if user exists
    existing_user = await users_collection.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Create new user
    hashed_password = get_password_hash(user.password)
    user_dict = {
        "username": user.username,
        "hashed_password": hashed_password,
        "created_at": datetime.utcnow(),
        "age": None,
        "height": None,
        "weight": None,
        "goal": "maintenance",
        "fitness_level": "beginner"
    }
    
    await users_collection.insert_one(user_dict)
    
    # Create access token
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/auth/login", response_model=Token)
async def login(user: User):
    # Find user
    db_user = await users_collection.find_one({"username": user.username})
    if not db_user or not verify_password(user.password, db_user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

# User Endpoints
@app.get("/users/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return {
        "username": current_user["username"],
        "age": current_user.get("age"),
        "height": current_user.get("height"),
        "weight": current_user.get("weight"),
        "goal": current_user.get("goal"),
        "fitness_level": current_user.get("fitness_level"),
        "created_at": current_user.get("created_at")
    }

@app.put("/users/me")
async def update_user_profile(
    age: Optional[int] = None,
    height: Optional[float] = None,
    weight: Optional[float] = None,
    goal: Optional[str] = None,
    fitness_level: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    update_data = {}
    if age is not None:
        update_data["age"] = age
    if height is not None:
        update_data["height"] = height
    if weight is not None:
        update_data["weight"] = weight
    if goal is not None:
        update_data["goal"] = goal
    if fitness_level is not None:
        update_data["fitness_level"] = fitness_level
    
    if update_data:
        await users_collection.update_one(
            {"username": current_user["username"]},
            {"$set": update_data}
        )
    
    return {"message": "Profile updated successfully"}

# Exercise Endpoints
@app.get("/api/exercises/search")
async def search_exercises(
    query: str = "",
    category: str = "all",
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Search exercises from cached database or ExerciseDB API"""
    
    # First check cache
    search_filter = {}
    if query:
        search_filter["name"] = {"$regex": query, "$options": "i"}
    if category != "all":
        search_filter["category"] = category
    
    cached_exercises = await exercises_collection.find(search_filter).limit(limit).to_list(limit)
    
    if cached_exercises:
        return {"exercises": cached_exercises, "source": "cache"}
    
    # If not in cache, fetch from API (requires RapidAPI key)
    if EXERCISEDB_API_KEY != "your-rapidapi-key":
        try:
            url = f"https://{EXERCISEDB_HOST}/exercises"
            headers = {
                "X-RapidAPI-Key": EXERCISEDB_API_KEY,
                "X-RapidAPI-Host": EXERCISEDB_HOST
            }
            
            response = requests.get(url, headers=headers, timeout=5)
            if response.status_code == 200:
                api_exercises = response.json()[:limit]
                
                # Cache exercises
                for exercise in api_exercises:
                    exercise["cached_at"] = datetime.utcnow()
                    await exercises_collection.insert_one(exercise)
                
                return {"exercises": api_exercises, "source": "api"}
        except Exception as e:
            print(f"API Error: {e}")
    
    # Return demo exercises if API not available
    demo_exercises = [
        {
            "id": "ex_001",
            "name": "Push-ups",
            "category": "Chest",
            "equipment": "Bodyweight",
            "difficulty": "Beginner",
            "instructions": ["Start in plank position", "Lower body until chest nearly touches floor", "Push back up"],
            "target_muscles": ["Chest", "Triceps", "Shoulders"]
        },
        {
            "id": "ex_002",
            "name": "Squats",
            "category": "Legs",
            "equipment": "Bodyweight",
            "difficulty": "Beginner",
            "instructions": ["Stand with feet shoulder-width apart", "Lower hips back and down", "Push through heels to stand"],
            "target_muscles": ["Quadriceps", "Glutes", "Hamstrings"]
        },
        {
            "id": "ex_003",
            "name": "Pull-ups",
            "category": "Back",
            "equipment": "Pull-up Bar",
            "difficulty": "Intermediate",
            "instructions": ["Hang from bar with overhand grip", "Pull body up until chin over bar", "Lower with control"],
            "target_muscles": ["Lats", "Biceps", "Upper Back"]
        },
        {
            "id": "ex_004",
            "name": "Plank",
            "category": "Core",
            "equipment": "Bodyweight",
            "difficulty": "Beginner",
            "instructions": ["Start in forearm plank position", "Keep body straight", "Hold position"],
            "target_muscles": ["Abs", "Core", "Lower Back"]
        },
        {
            "id": "ex_005",
            "name": "Lunges",
            "category": "Legs",
            "equipment": "Bodyweight",
            "difficulty": "Beginner",
            "instructions": ["Step forward with one leg", "Lower hips until both knees at 90 degrees", "Push back to start"],
            "target_muscles": ["Quadriceps", "Glutes", "Hamstrings"]
        }
    ]
    
    return {"exercises": demo_exercises, "source": "demo"}

@app.get("/api/exercises/{exercise_id}")
async def get_exercise_detail(
    exercise_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed information about a specific exercise"""
    exercise = await exercises_collection.find_one({"id": exercise_id})
    if not exercise:
        raise HTTPException(status_code=404, detail="Exercise not found")
    return exercise

# Nutrition Endpoints
@app.post("/api/nutrition/search")
async def search_food(
    search: FoodSearch,
    current_user: dict = Depends(get_current_user)
):
    """Search food from cached database or USDA API"""
    
    # Check cache first
    cached_foods = await foods_collection.find(
        {"name": {"$regex": search.query, "$options": "i"}}
    ).limit(10).to_list(10)
    
    if cached_foods:
        return {"foods": cached_foods, "source": "cache"}
    
    # Fetch from USDA API
    try:
        url = f"{USDA_BASE_URL}/foods/search"
        params = {
            "api_key": USDA_API_KEY,
            "query": search.query,
            "pageSize": 10
        }
        
        response = requests.get(url, params=params, timeout=5)
        if response.status_code == 200:
            data = response.json()
            foods = []
            
            for item in data.get("foods", []):
                food = {
                    "id": item.get("fdcId"),
                    "name": item.get("description"),
                    "calories": next((n["value"] for n in item.get("foodNutrients", []) if n["nutrientName"] == "Energy"), 0),
                    "protein": next((n["value"] for n in item.get("foodNutrients", []) if n["nutrientName"] == "Protein"), 0),
                    "carbs": next((n["value"] for n in item.get("foodNutrients", []) if n["nutrientName"] == "Carbohydrate, by difference"), 0),
                    "fat": next((n["value"] for n in item.get("foodNutrients", []) if n["nutrientName"] == "Total lipid (fat)"), 0),
                    "cached_at": datetime.utcnow()
                }
                foods.append(food)
                
                # Cache the food
                await foods_collection.insert_one(food)
            
            return {"foods": foods, "source": "api"}
    except Exception as e:
        print(f"USDA API Error: {e}")
    
    # Return demo foods
    demo_foods = [
        {"id": "f_001", "name": "Chicken Breast (100g)", "calories": 165, "protein": 31, "carbs": 0, "fat": 3.6},
        {"id": "f_002", "name": "Brown Rice (100g)", "calories": 111, "protein": 2.6, "carbs": 23, "fat": 0.9},
        {"id": "f_003", "name": "Broccoli (100g)", "calories": 34, "protein": 2.8, "carbs": 7, "fat": 0.4},
        {"id": "f_004", "name": "Salmon (100g)", "calories": 206, "protein": 22, "carbs": 0, "fat": 13},
        {"id": "f_005", "name": "Banana", "calories": 89, "protein": 1.1, "carbs": 23, "fat": 0.3}
    ]
    
    return {"foods": demo_foods, "source": "demo"}

@app.post("/api/nutrition/log")
async def log_nutrition(
    log: NutritionLog,
    current_user: dict = Depends(get_current_user)
):
    """Log a food item to user's nutrition diary"""
    log_dict = log.dict()
    log_dict["username"] = current_user["username"]
    log_dict["logged_at"] = datetime.utcnow()
    
    await nutrition_logs_collection.insert_one(log_dict)
    return {"message": "Nutrition logged successfully"}

@app.get("/api/nutrition/daily")
async def get_daily_nutrition(
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get nutrition summary for a specific date"""
    if date is None:
        date = datetime.utcnow().date()
    else:
        date = datetime.fromisoformat(date).date()
    
    # Get all logs for the day
    start_of_day = datetime.combine(date, datetime.min.time())
    end_of_day = datetime.combine(date, datetime.max.time())
    
    logs = await nutrition_logs_collection.find({
        "username": current_user["username"],
        "logged_at": {"$gte": start_of_day, "$lte": end_of_day}
    }).to_list(100)
    
    # Calculate totals
    total_calories = sum(log["calories"] for log in logs)
    total_protein = sum(log["protein"] for log in logs)
    total_carbs = sum(log["carbs"] for log in logs)
    total_fat = sum(log["fat"] for log in logs)
    
    return {
        "date": date.isoformat(),
        "logs": logs,
        "totals": {
            "calories": total_calories,
            "protein": total_protein,
            "carbs": total_carbs,
            "fat": total_fat
        }
    }

# Workout Endpoints
@app.post("/api/workouts/log")
async def log_workout(
    workout: WorkoutSession,
    current_user: dict = Depends(get_current_user)
):
    """Log a completed workout session"""
    workout_dict = workout.dict()
    workout_dict["username"] = current_user["username"]
    workout_dict["completed_at"] = datetime.utcnow()
    
    await workouts_collection.insert_one(workout_dict)
    return {"message": "Workout logged successfully"}

@app.get("/api/workouts/history")
async def get_workout_history(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get user's workout history"""
    workouts = await workouts_collection.find(
        {"username": current_user["username"]}
    ).sort("completed_at", -1).limit(limit).to_list(limit)
    
    return {"workouts": workouts}

@app.get("/api/workouts/stats")
async def get_workout_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get workout statistics"""
    # Get workouts from last 7 days
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    
    recent_workouts = await workouts_collection.find({
        "username": current_user["username"],
        "completed_at": {"$gte": seven_days_ago}
    }).to_list(100)
    
    total_workouts = len(recent_workouts)
    total_reps = sum(w["reps"] * w["sets"] for w in recent_workouts)
    total_duration = sum(w["duration"] for w in recent_workouts)
    
    return {
        "week": {
            "total_workouts": total_workouts,
            "total_reps": total_reps,
            "total_duration_minutes": total_duration // 60
        }
    }

# Mental Health Endpoints
@app.post("/api/mental/log")
async def log_mood(
    mood_log: MoodLog,
    current_user: dict = Depends(get_current_user)
):
    """Log mood and journal entry"""
    log_dict = mood_log.dict()
    log_dict["username"] = current_user["username"]
    log_dict["logged_at"] = datetime.utcnow()
    
    await mental_health_collection.insert_one(log_dict)
    return {"message": "Mood logged successfully"}

@app.get("/api/mental/history")
async def get_mood_history(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get mood history"""
    start_date = datetime.utcnow() - timedelta(days=days)
    
    logs = await mental_health_collection.find({
        "username": current_user["username"],
        "logged_at": {"$gte": start_date}
    }).sort("logged_at", -1).to_list(100)
    
    return {"logs": logs}

# Health Check
@app.get("/")
async def root():
    return {
        "message": "AI Fitness Coach API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)