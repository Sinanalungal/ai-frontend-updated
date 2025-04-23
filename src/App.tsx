import './App.css'
import LayerViewer from './components/LayerViewer/LayerViewer'
import Viewer from './components/Viewer/Viewer'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

function App() {
  return (
    <Router>
        <Routes>
          <Route path="/" element={<Viewer />} />
          <Route path="/layer" element={<LayerViewer />} />
        </Routes>
    </Router>
  )
}

export default App
