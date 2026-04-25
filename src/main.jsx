import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// Strip trailing slash; BrowserRouter expects basename WITHOUT one. In dev
// `import.meta.env.BASE_URL` is "/", in Pages builds "/JerseyModelMaker/".
const basename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter basename={basename}>
    <App />
  </BrowserRouter>,
)
