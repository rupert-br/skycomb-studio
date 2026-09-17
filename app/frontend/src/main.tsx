import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "mapbox-gl/dist/mapbox-gl.css"
import "./globals.css"
import App from "./App"

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
