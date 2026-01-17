// Signup.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Lock, Calendar, Heart, Info } from "lucide-react";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ;


export default function Signup({ setCurrentUserId }) {
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    email: "",
    password: "",
    confirmPassword: "",
    menstruationCycleType: "regular"
  });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      // Basic validation
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          age: Number(formData.age),
          email: formData.email,
          password: formData.password,
          menstruationCycleType: formData.menstruationCycleType
        }),
      });

      if (response.ok) {
        const user = await response.json();
        setCurrentUserId(user._id);
        navigate("/");
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Registration failed");
      }
    } catch (err) {
      setError("Registration failed");
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f7f2] flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-lg w-96 border border-[#e2ded5]">
        <div className="flex items-center justify-center mb-6">
          <Heart size={32} className="text-[#d89171] mr-2" />
          <h1 className="text-2xl font-bold text-[#3d3d3d]">Get Started</h1>
        </div>

        {error && <div className="mb-4 p-2 text-red-500 text-sm text-center">{error}</div>}

        <form onSubmit={handleSignup} className="space-y-4">
          {/* Name Field */}
          <div>
            <label className="block text-sm text-[#555555] mb-1">Full Name</label>
            <div className="flex items-center border border-[#e2ded5] rounded-lg p-2">
              <User size={18} className="text-[#555555] mr-2" />
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full outline-none"
                placeholder="Jane Doe"
                required
              />
            </div>
          </div>

          {/* Age Field */}
          <div>
            <label className="block text-sm text-[#555555] mb-1">Age</label>
            <div className="flex items-center border border-[#e2ded5] rounded-lg p-2">
              <Calendar size={18} className="text-[#555555] mr-2" />
              <input
                type="number"
                name="age"
                value={formData.age}
                onChange={handleChange}
                className="w-full outline-none"
                placeholder="25"
                min="13"
                max="100"
                required
              />
            </div>
          </div>

          {/* Email Field */}
          <div>
            <label className="block text-sm text-[#555555] mb-1">Email</label>
            <div className="flex items-center border border-[#e2ded5] rounded-lg p-2">
              <Info size={18} className="text-[#555555] mr-2" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full outline-none"
                placeholder="jane@example.com"
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm text-[#555555] mb-1">Password</label>
            <div className="flex items-center border border-[#e2ded5] rounded-lg p-2">
              <Lock size={18} className="text-[#555555] mr-2" />
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full outline-none"
                placeholder="••••••••"
                minLength="8"
                required
              />
            </div>
          </div>

          {/* Confirm Password Field */}
          <div>
            <label className="block text-sm text-[#555555] mb-1">Confirm Password</label>
            <div className="flex items-center border border-[#e2ded5] rounded-lg p-2">
              <Lock size={18} className="text-[#555555] mr-2" />
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full outline-none"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {/* Cycle Type Field */}
          <div>
            <label className="block text-sm text-[#555555] mb-1">Menstrual Cycle</label>
            <div className="flex items-center border border-[#e2ded5] rounded-lg p-2">
              <Heart size={18} className="text-[#555555] mr-2" />
              <select
                name="menstruationCycleType"
                value={formData.menstruationCycleType}
                onChange={handleChange}
                className="w-full outline-none bg-transparent"
                required
              >
                <option value="regular">Regular Cycle</option>
                <option value="irregular">Irregular Cycle</option>
                <option value="Menopause">Menopause</option>
                <option value="unknown">Prefer not to say</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-[#d89171] hover:bg-[#c68266] text-white py-2 rounded-lg font-medium transition-colors"
          >
            Create Account
          </button>
        </form>

        <p className="text-center mt-4 text-sm text-[#555555]">
          Already have an account?{" "}
          <Link to="/login" className="text-[#d89171] hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}