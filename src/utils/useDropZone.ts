import { useRef, useState, type DragEvent } from 'react'

export function useDropZone(onFiles: (files: File[]) => void) {
  const [dragOver, setDragOver] = useState(false)
  const counter = useRef(0)

  const bind = {
    onDragEnter: (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      counter.current++
      if (e.dataTransfer.types.includes('Files')) setDragOver(true)
    },
    onDragOver: (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
    },
    onDragLeave: (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      counter.current--
      if (counter.current <= 0) {
        counter.current = 0
        setDragOver(false)
      }
    },
    onDrop: (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      counter.current = 0
      setDragOver(false)
      onFiles(Array.from(e.dataTransfer.files))
    },
  }

  return { dragOver, bind }
}
