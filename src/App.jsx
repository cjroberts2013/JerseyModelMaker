import { Routes, Route } from 'react-router-dom'
import SportSelector from './components/SportSelector.jsx'
import ModelGallery from './components/ModelGallery.jsx'
import Editor from './components/Editor.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SportSelector />} />
      <Route path="/sport/:sport" element={<ModelGallery />} />
      <Route path="/editor/:modelId" element={<Editor />} />
    </Routes>
  )
}
