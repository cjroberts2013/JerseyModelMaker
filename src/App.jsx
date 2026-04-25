import { Routes, Route } from 'react-router-dom'
import ModelGallery from './components/ModelGallery.jsx'
import Editor from './components/Editor.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ModelGallery />} />
      <Route path="/editor/:modelId" element={<Editor />} />
    </Routes>
  )
}
