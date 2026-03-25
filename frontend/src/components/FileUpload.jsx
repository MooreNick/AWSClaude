import { useRef } from 'react';

export default function FileUpload({ accept, multiple, onFiles, label }) {
  const inputRef = useRef();

  const handleChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length) onFiles(files);
  };

  return (
    <div className="file-upload">
      <button type="button" className="btn btn-outline" onClick={() => inputRef.current.click()}>
        {label || 'Choose Files'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}
