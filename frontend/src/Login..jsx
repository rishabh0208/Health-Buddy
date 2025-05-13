// Login.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, Heart } from "lucide-react";

export default function Login({ setCurrentUserId }) {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("https://assignment-y3e0.onrender.com/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const { userId } = await response.json();
        setCurrentUserId(userId);
        navigate("/");
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Invalid credentials");
      }
    } catch (err) {
      setError("Login failed");
    }
  };

  return (
    <div className="min-h-screen bg-[#f9f7f2] flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-lg w-96 border border-[#e2ded5]">
        <div className="flex items-center justify-center mb-6">
          <Heart size={32} className="text-[#d89171] mr-2" />
          <h1 className="text-2xl font-bold text-[#3d3d3d]">Welcome Back</h1>
        </div>

        {error && <div className="mb-4 p-2 text-red-500 text-sm text-center">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email Field */}
          <div>
            <label className="block text-sm text-[#555555] mb-1">Email</label>
            <div className="flex items-center border border-[#e2ded5] rounded-lg p-2">
              <Mail size={18} className="text-[#555555] mr-2" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full outline-none"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-[#d89171] hover:bg-[#c68266] text-white py-2 rounded-lg font-medium transition-colors"
          >
            Login
          </button>
        </form>

        <p className="text-center mt-4 text-sm text-[#555555]">
          Don't have an account?{" "}
          <Link to="/signup" className="text-[#d89171] hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}