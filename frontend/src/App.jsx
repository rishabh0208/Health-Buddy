import { useState , useEffect} from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./Login.";
import Signup from "./Signup";
import Dashboard from "./Dashboard";

function App() {
  const [currentUserId,setCurrentUserId] = useState(() => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : null;
  });
 
  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem("user", JSON.stringify(currentUserId));
    } else {
      localStorage.removeItem("user");
    }
  }, [currentUserId]);

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            currentUserId ? (
              <Dashboard currentUserId={currentUserId} setCurrentUserId={setCurrentUserId} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/login"
          element={<Login setCurrentUserId={setCurrentUserId} />}
        />
        <Route
          path="/signup"
          element={<Signup setCurrentUserId={setCurrentUserId} />}
        />
      </Routes>
    </Router>
  );
}

export default  App;