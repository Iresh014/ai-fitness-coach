import React, { useState, useEffect, useRef } from 'react';
import { Camera, Dumbbell, Apple, Brain, TrendingUp, User, LogOut, Menu, X, Search, Filter, Play, ChevronRight, Award, Target, Calendar } from 'lucide-react';

// API Configuration
const API_BASE_URL = 'http://localhost:8000';
const EXERCISEDB_API_KEY = 'YOUR_RAPIDAPI_KEY'; // Get from RapidAPI
const USDA_API_KEY = 'YOUR_USDA_API_KEY'; // Get from FoodData Central

const App = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  // Authentication check on mount
  useEffect(() => {
    const token = localStorage.getItem('fitness_token');
    if (token) {
      fetchUserProfile(token);
    }
  }, []);

  const fetchUserProfile = async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data);
      } else {
        localStorage.removeItem('fitness_token');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('fitness_token');
    setCurrentUser(null);
    setCurrentPage('dashboard');
  };

  if (!currentUser) {
    return <AuthPage setCurrentUser={setCurrentUser} fetchUserProfile={fetchUserProfile} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Navigation */}
      <nav className="bg-black/30 backdrop-blur-lg border-b border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Dumbbell className="w-8 h-8 text-purple-400" />
              <span className="text-xl font-bold text-white">AI Fitness Coach</span>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex space-x-4">
              <NavButton icon={TrendingUp} label="Dashboard" active={currentPage === 'dashboard'} onClick={() => setCurrentPage('dashboard')} />
              <NavButton icon={Camera} label="Workout" active={currentPage === 'workout'} onClick={() => setCurrentPage('workout')} />
              <NavButton icon={Dumbbell} label="Exercises" active={currentPage === 'exercises'} onClick={() => setCurrentPage('exercises')} />
              <NavButton icon={Apple} label="Nutrition" active={currentPage === 'nutrition'} onClick={() => setCurrentPage('nutrition')} />
              <NavButton icon={Brain} label="Mental Health" active={currentPage === 'mental'} onClick={() => setCurrentPage('mental')} />
              <NavButton icon={User} label="Profile" active={currentPage === 'profile'} onClick={() => setCurrentPage('profile')} />
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-white hidden md:block">Hey, {currentUser.username}!</span>
              <button onClick={handleLogout} className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400">
                <LogOut className="w-5 h-5" />
              </button>
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-white">
                {isMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-black/50 backdrop-blur-lg border-t border-purple-500/20">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <MobileNavButton icon={TrendingUp} label="Dashboard" onClick={() => { setCurrentPage('dashboard'); setIsMenuOpen(false); }} />
              <MobileNavButton icon={Camera} label="Workout" onClick={() => { setCurrentPage('workout'); setIsMenuOpen(false); }} />
              <MobileNavButton icon={Dumbbell} label="Exercises" onClick={() => { setCurrentPage('exercises'); setIsMenuOpen(false); }} />
              <MobileNavButton icon={Apple} label="Nutrition" onClick={() => { setCurrentPage('nutrition'); setIsMenuOpen(false); }} />
              <MobileNavButton icon={Brain} label="Mental Health" onClick={() => { setCurrentPage('mental'); setIsMenuOpen(false); }} />
              <MobileNavButton icon={User} label="Profile" onClick={() => { setCurrentPage('profile'); setIsMenuOpen(false); }} />
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentPage === 'dashboard' && <Dashboard user={currentUser} />}
        {currentPage === 'workout' && <WorkoutPage user={currentUser} />}
        {currentPage === 'exercises' && <ExercisesPage />}
        {currentPage === 'nutrition' && <NutritionPage />}
        {currentPage === 'mental' && <MentalHealthPage />}
        {currentPage === 'profile' && <ProfilePage user={currentUser} />}
      </main>
    </div>
  );
};

// Navigation Components
const NavButton = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
      active 
        ? 'bg-purple-600 text-white' 
        : 'text-gray-300 hover:bg-purple-500/20 hover:text-white'
    }`}
  >
    <Icon className="w-5 h-5" />
    <span>{label}</span>
  </button>
);

const MobileNavButton = ({ icon: Icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center space-x-3 w-full px-3 py-2 rounded-lg text-gray-300 hover:bg-purple-500/20 hover:text-white transition-all"
  >
    <Icon className="w-5 h-5" />
    <span>{label}</span>
  </button>
);

// Authentication Page
const AuthPage = ({ setCurrentUser, fetchUserProfile }) => {
  const [authMode, setAuthMode] = useState('login');
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/signup';
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('fitness_token', data.access_token);
        await fetchUserProfile(data.access_token);
      } else {
        setError(data.detail || 'Authentication failed');
      }
    } catch (error) {
      setError('Network error. Please check if backend is running on localhost:8000');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-8 w-full max-w-md border border-purple-500/20">
        <div className="text-center mb-8">
          <Dumbbell className="w-16 h-16 text-purple-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">AI Fitness Coach</h1>
          <p className="text-gray-400">Your Personal AI-Powered Wellness Assistant</p>
        </div>

        <div className="flex space-x-2 mb-6">
          <button
            onClick={() => setAuthMode('login')}
            className={`flex-1 py-2 rounded-lg font-medium transition-all ${
              authMode === 'login'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setAuthMode('signup')}
            className={`flex-1 py-2 rounded-lg font-medium transition-all ${
              authMode === 'signup'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-300 mb-2">Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-purple-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-purple-500 focus:outline-none"
              required
            />
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-all disabled:opacity-50"
          >
            {loading ? 'Processing...' : authMode === 'login' ? 'Login' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          <p>Demo credentials: username: demo | password: demo123</p>
        </div>
      </div>
    </div>
  );
};

// Dashboard Page
const Dashboard = ({ user }) => {
  return (
    <div className="space-y-6">
      <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20">
        <h2 className="text-2xl font-bold text-white mb-4">Welcome back, {user.username}! 👋</h2>
        <p className="text-gray-400">Ready to crush your fitness goals today?</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={Award} label="Workouts This Week" value="5" color="purple" />
        <StatCard icon={Target} label="Calories Burned" value="2,450" color="green" />
        <StatCard icon={Calendar} label="Current Streak" value="12 days" color="blue" />
        <StatCard icon={TrendingUp} label="Progress" value="85%" color="orange" />
      </div>

      {/* Today's Workout */}
      <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center">
          <Play className="w-6 h-6 mr-2 text-purple-400" />
          Today's Recommended Workout
        </h3>
        <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-xl p-6 border border-purple-500/30">
          <h4 className="text-lg font-semibold text-white mb-2">Upper Body Strength</h4>
          <p className="text-gray-400 mb-4">45 minutes • 8 exercises • Intermediate</p>
          <button className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-all">
            Start Workout
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickActionCard
          icon={Camera}
          title="Live Workout"
          description="Start pose-guided exercise"
          color="purple"
        />
        <QuickActionCard
          icon={Apple}
          title="Log Meal"
          description="Track your nutrition"
          color="green"
        />
        <QuickActionCard
          icon={Brain}
          title="Mental Check"
          description="How are you feeling?"
          color="blue"
        />
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color }) => {
  const colorClasses = {
    purple: 'from-purple-600/20 to-purple-800/20 border-purple-500/30',
    green: 'from-green-600/20 to-green-800/20 border-green-500/30',
    blue: 'from-blue-600/20 to-blue-800/20 border-blue-500/30',
    orange: 'from-orange-600/20 to-orange-800/20 border-orange-500/30'
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} backdrop-blur-xl rounded-xl p-6 border`}>
      <Icon className="w-8 h-8 text-white mb-3" />
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
};

const QuickActionCard = ({ icon: Icon, title, description, color }) => {
  const colorClasses = {
    purple: 'hover:border-purple-500/50',
    green: 'hover:border-green-500/50',
    blue: 'hover:border-blue-500/50'
  };

  return (
    <div className={`bg-black/40 backdrop-blur-xl rounded-xl p-6 border border-purple-500/20 ${colorClasses[color]} hover:bg-black/60 transition-all cursor-pointer group`}>
      <Icon className="w-10 h-10 text-purple-400 mb-3 group-hover:scale-110 transition-transform" />
      <h4 className="text-white font-semibold mb-1">{title}</h4>
      <p className="text-gray-400 text-sm">{description}</p>
      <ChevronRight className="w-5 h-5 text-purple-400 mt-2 group-hover:translate-x-2 transition-transform" />
    </div>
  );
};

// Workout Page with Camera
const WorkoutPage = ({ user }) => {
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);

  const startWorkout = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsWorkoutActive(true);
      }
    } catch (error) {
      setCameraError('Camera access denied. Please enable camera permissions.');
    }
  };

  const stopWorkout = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setIsWorkoutActive(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20">
        <h2 className="text-2xl font-bold text-white mb-4">Live Workout Session</h2>
        <p className="text-gray-400">AI-powered pose detection and form correction</p>
      </div>

      {/* Camera View */}
      <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20">
        {!isWorkoutActive ? (
          <div className="text-center py-20">
            <Camera className="w-20 h-20 text-purple-400 mx-auto mb-6" />
            <h3 className="text-xl font-semibold text-white mb-4">Ready to start your workout?</h3>
            <p className="text-gray-400 mb-6">Enable your camera for real-time pose detection and form correction</p>
            <button
              onClick={startWorkout}
              className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-all"
            >
              Start Workout
            </button>
            {cameraError && (
              <p className="mt-4 text-red-400 text-sm">{cameraError}</p>
            )}
          </div>
        ) : (
          <div>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full rounded-lg mb-4"
            />
            <div className="flex justify-between items-center">
              <div className="text-white">
                <p className="text-sm text-gray-400">Exercise: Push-ups</p>
                <p className="text-2xl font-bold">Reps: 0</p>
              </div>
              <button
                onClick={stopWorkout}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all"
              >
                Stop Workout
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Workout Instructions */}
      <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20">
        <h3 className="text-lg font-semibold text-white mb-4">📋 How It Works</h3>
        <div className="space-y-3 text-gray-300">
          <p>• Stand in front of your camera with your full body visible</p>
          <p>• Follow the on-screen exercise guide</p>
          <p>• AI will count your reps and correct your form in real-time</p>
          <p>• Get instant feedback on your posture and technique</p>
        </div>
      </div>
    </div>
  );
};

// Exercises Page
const ExercisesPage = () => {
  const [exercises, setExercises] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExercises();
  }, []);

  const loadExercises = async () => {
    setLoading(true);
    // Demo exercises - In production, fetch from ExerciseDB API
    const demoExercises = [
      { id: 1, name: 'Push-ups', category: 'Chest', equipment: 'Bodyweight', difficulty: 'Beginner' },
      { id: 2, name: 'Squats', category: 'Legs', equipment: 'Bodyweight', difficulty: 'Beginner' },
      { id: 3, name: 'Pull-ups', category: 'Back', equipment: 'Bar', difficulty: 'Intermediate' },
      { id: 4, name: 'Deadlift', category: 'Back', equipment: 'Barbell', difficulty: 'Advanced' },
      { id: 5, name: 'Bench Press', category: 'Chest', equipment: 'Barbell', difficulty: 'Intermediate' },
      { id: 6, name: 'Lunges', category: 'Legs', equipment: 'Bodyweight', difficulty: 'Beginner' },
      { id: 7, name: 'Shoulder Press', category: 'Shoulders', equipment: 'Dumbbells', difficulty: 'Intermediate' },
      { id: 8, name: 'Planks', category: 'Core', equipment: 'Bodyweight', difficulty: 'Beginner' }
    ];
    setExercises(demoExercises);
    setLoading(false);
  };

  const categories = ['all', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];

  const filteredExercises = exercises.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || ex.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20">
        <h2 className="text-2xl font-bold text-white mb-4">Exercise Library</h2>
        <p className="text-gray-400">Browse 1300+ exercises with detailed instructions</p>
      </div>

      {/* Search and Filter */}
      <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search exercises..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-purple-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Exercise Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredExercises.map(exercise => (
          <ExerciseCard key={exercise.id} exercise={exercise} />
        ))}
      </div>

      {filteredExercises.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No exercises found. Try different search terms or categories.
        </div>
      )}
    </div>
  );
};

const ExerciseCard = ({ exercise }) => (
  <div className="bg-black/40 backdrop-blur-xl rounded-xl p-6 border border-purple-500/20 hover:border-purple-500/50 transition-all cursor-pointer group">
    <div className="flex justify-between items-start mb-4">
      <h3 className="text-white font-semibold text-lg">{exercise.name}</h3>
      <span className={`px-2 py-1 rounded text-xs font-medium ${
        exercise.difficulty === 'Beginner' ? 'bg-green-500/20 text-green-400' :
        exercise.difficulty === 'Intermediate' ? 'bg-yellow-500/20 text-yellow-400' :
        'bg-red-500/20 text-red-400'
      }`}>
        {exercise.difficulty}
      </span>
    </div>
    <div className="space-y-2 text-sm text-gray-400">
      <p>Category: {exercise.category}</p>
      <p>Equipment: {exercise.equipment}</p>
    </div>
    <button className="mt-4 w-full py-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 rounded-lg font-medium transition-all group-hover:bg-purple-600 group-hover:text-white">
      View Details
    </button>
  </div>
);

// Nutrition Page
const NutritionPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchFood = async () => {
    if (!searchTerm) return;
    setLoading(true);
    
    // Demo foods - In production, fetch from USDA API
    const demoFoods = [
      { id: 1, name: 'Chicken Breast (100g)', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
      { id: 2, name: 'Brown Rice (100g)', calories: 111, protein: 2.6, carbs: 23, fat: 0.9 },
      { id: 3, name: 'Broccoli (100g)', calories: 34, protein: 2.8, carbs: 7, fat: 0.4 },
      { id: 4, name: 'Salmon (100g)', calories: 206, protein: 22, carbs: 0, fat: 13 },
      { id: 5, name: 'Banana', calories: 89, protein: 1.1, carbs: 23, fat: 0.3 }
    ];
    
    setFoods(demoFoods.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase())));
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20">
        <h2 className="text-2xl font-bold text-white mb-4">Nutrition Tracker</h2>
        <p className="text-gray-400">Search from 300,000+ foods and track your macros</p>
      </div>

      {/* Search */}
      <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search for food..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchFood()}
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-purple-500 focus:outline-none"
            />
          </div>
          <button
            onClick={searchFood}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-all"
          >
            Search
          </button>
        </div>
      </div>

      {/* Daily Summary */}
      <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20">
        <h3 className="text-lg font-semibold text-white mb-4">Today's Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MacroCard label="Calories" value="1,850" target="2,200" color="purple" />
          <MacroCard label="Protein" value="120g" target="150g" color="blue" />
          <MacroCard label="Carbs" value="180g" target="250g" color="green" />
          <MacroCard label="Fat" value="55g" target="70g" color="orange" />
        </div>
      </div>

      {/* Food Results */}
      {foods.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {foods.map(food => (
            <FoodCard key={food.id} food={food} />
          ))}
        </div>
      )}
    </div>
  );
};

const MacroCard = ({ label, value, target, color }) => {
  const percentage = Math.round((parseInt(value) / parseInt(target)) * 100);
  
  const colorClasses = {
    purple: 'text-purple-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
    orange: 'text-orange-400'
  };

  return (
    <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-lg p-4">
      <p className="text-gray-400 text-sm mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorClasses[color]} mb-1`}>{value}</p>
      <p className="text-gray-500 text-xs">Target: {target}</p>
      <div className="mt-2 bg-gray-700 rounded-full h-2 overflow-hidden">
        <div 
          className={`h-full bg-gradient-to-r ${
            color === 'purple' ? 'from-purple-500 to-purple-600' :
            color === 'blue' ? 'from-blue-500 to-blue-600' :
            color === 'green' ? 'from-green-500 to-green-600' :
            'from-orange-500 to-orange-600'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
};

const FoodCard = ({ food }) => (
  <div className="bg-black/40 backdrop-blur-xl rounded-xl p-6 border border-purple-500/20 hover:border-purple-500/50 transition-all">
    <h3 className="text-white font-semibold text-lg mb-4">{food.name}</h3>
    <div className="grid grid-cols-4 gap-4 mb-4">
      <div className="text-center">
        <p className="text-gray-400 text-xs mb-1">Calories</p>
        <p className="text-white font-bold">{food.calories}</p>
      </div>
      <div className="text-center">
        <p className="text-gray-400 text-xs mb-1">Protein</p>
        <p className="text-blue-400 font-bold">{food.protein}g</p>
      </div>
      <div className="text-center">
        <p className="text-gray-400 text-xs mb-1">Carbs</p>
        <p className="text-green-400 font-bold">{food.carbs}g</p>
      </div>
      <div className="text-center">
        <p className="text-gray-400 text-xs mb-1">Fat</p>
        <p className="text-orange-400 font-bold">{food.fat}g</p>
      </div>
    </div>
    <button className="w-full py-2 bg-purple-600/20 hover:bg-purple-600 text-purple-400 hover:text-white rounded-lg font-medium transition-all">
      Add to Diary
    </button>
  </div>
);

// Mental Health Page
const MentalHealthPage = () => {
  const [mood, setMood] = useState('');
  const [journal, setJournal] = useState('');

  const moods = [
    { emoji: '😊', label: 'Great', value: 'great' },
    { emoji: '🙂', label: 'Good', value: 'good' },
    { emoji: '😐', label: 'Okay', value: 'okay' },
    { emoji: '😔', label: 'Low', value: 'low' },
    { emoji: '😢', label: 'Stressed', value: 'stressed' }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20">
        <h2 className="text-2xl font-bold text-white mb-4">Mental Wellness</h2>
        <p className="text-gray-400">Track your mood and mental health journey</p>
      </div>

      {/* Mood Tracker */}
      <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20">
        <h3 className="text-lg font-semibold text-white mb-4">How are you feeling today?</h3>
        <div className="grid grid-cols-5 gap-4">
          {moods.map(m => (
            <button
              key={m.value}
              onClick={() => setMood(m.value)}
              className={`p-6 rounded-xl transition-all ${
                mood === m.value
                  ? 'bg-purple-600 border-2 border-purple-400'
                  : 'bg-gray-800 border-2 border-gray-700 hover:border-purple-500/50'
              }`}
            >
              <div className="text-4xl mb-2">{m.emoji}</div>
              <p className="text-white text-sm">{m.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Journal */}
      <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20">
        <h3 className="text-lg font-semibold text-white mb-4">Daily Journal</h3>
        <textarea
          value={journal}
          onChange={(e) => setJournal(e.target.value)}
          placeholder="Write about your day, thoughts, or feelings..."
          className="w-full h-40 px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-purple-500 focus:outline-none resize-none"
        />
        <button className="mt-4 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-all">
          Save Entry
        </button>
      </div>

      {/* Wellness Tips */}
      <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20">
        <h3 className="text-lg font-semibold text-white mb-4">💡 Today's Wellness Tip</h3>
        <p className="text-gray-300 leading-relaxed">
          Take a 5-minute breathing break. Inhale deeply for 4 counts, hold for 4, exhale for 4. 
          This simple practice can reduce stress and improve focus throughout your day.
        </p>
      </div>
    </div>
  );
};

// Profile Page
const ProfilePage = ({ user }) => {
  const [profile, setProfile] = useState({
    age: 25,
    height: 175,
    weight: 70,
    goal: 'muscle_gain',
    fitnessLevel: 'intermediate'
  });

  return (
    <div className="space-y-6">
      <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20">
        <h2 className="text-2xl font-bold text-white mb-4">Your Profile</h2>
        <p className="text-gray-400">Manage your fitness profile and preferences</p>
      </div>

      {/* Profile Info */}
      <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20">
        <div className="flex items-center space-x-4 mb-6">
          <div className="w-20 h-20 rounded-full bg-purple-600 flex items-center justify-center">
            <User className="w-10 h-10 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white">{user.username}</h3>
            <p className="text-gray-400">Fitness Enthusiast</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-gray-300 mb-2">Age</label>
            <input
              type="number"
              value={profile.age}
              onChange={(e) => setProfile({ ...profile, age: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-purple-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-gray-300 mb-2">Height (cm)</label>
            <input
              type="number"
              value={profile.height}
              onChange={(e) => setProfile({ ...profile, height: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-purple-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-gray-300 mb-2">Weight (kg)</label>
            <input
              type="number"
              value={profile.weight}
              onChange={(e) => setProfile({ ...profile, weight: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-purple-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-gray-300 mb-2">Fitness Goal</label>
            <select
              value={profile.goal}
              onChange={(e) => setProfile({ ...profile, goal: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-purple-500 focus:outline-none"
            >
              <option value="weight_loss">Weight Loss</option>
              <option value="muscle_gain">Muscle Gain</option>
              <option value="maintenance">Maintenance</option>
              <option value="endurance">Build Endurance</option>
            </select>
          </div>
        </div>

        <button className="mt-6 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-all">
          Save Changes
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-black/40 backdrop-blur-xl rounded-xl p-6 border border-purple-500/20 text-center">
          <p className="text-gray-400 mb-2">BMI</p>
          <p className="text-3xl font-bold text-white">22.9</p>
          <p className="text-green-400 text-sm mt-1">Normal</p>
        </div>
        <div className="bg-black/40 backdrop-blur-xl rounded-xl p-6 border border-purple-500/20 text-center">
          <p className="text-gray-400 mb-2">Daily Calories</p>
          <p className="text-3xl font-bold text-white">2,200</p>
          <p className="text-gray-400 text-sm mt-1">Recommended</p>
        </div>
        <div className="bg-black/40 backdrop-blur-xl rounded-xl p-6 border border-purple-500/20 text-center">
          <p className="text-gray-400 mb-2">Member Since</p>
          <p className="text-3xl font-bold text-white">30</p>
          <p className="text-gray-400 text-sm mt-1">Days</p>
        </div>
      </div>
    </div>
  );
};

export default App;