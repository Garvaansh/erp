```
import axios from "axios";

// Backend API (Go server). Use 3001 so it doesn't conflict with Next.js dev server on 3000.
export const API_URL = "http://localhost:3001/api/v1";

const api = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

const MOCK_DATA_KEY = "mock_data";

api.interceptors.request.use((config) => {
    if (typeof window!== "undefined") {
        const token = localStorage.getItem("token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        // When "Mock data" toggle is ON, backend returns paginated mock data (1L records total)
        if (localStorage.getItem(MOCK_DATA_KEY) === "true") {
            config.headers["X-Mock-Data"] = "true";
        }
    }
    return config;
});

export default api;
export { MOCK_DATA_KEY };
```