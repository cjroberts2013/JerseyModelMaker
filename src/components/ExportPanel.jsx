export default function ExportPanel({ onOpenDownloadDialog }) {
  return (
    <div>
      <button
        onClick={onOpenDownloadDialog}
        className="w-full py-3 rounded text-white font-semibold text-sm tracking-wide"
        style={{ background: 'linear-gradient(90deg,#7c3aed 0%,#4f46e5 100%)' }}
      >
        DOWNLOAD MODEL
      </button>
    </div>
  )
}
