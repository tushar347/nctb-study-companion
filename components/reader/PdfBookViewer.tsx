"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfBookViewer() {
  const [numPages, setNumPages] = useState<number>(0);

  const [pageNumber, setPageNumber] = useState(1);

  const [scale, setScale] = useState(1.2);

  function onLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  function nextPage() {
    setPageNumber((page) => {
      if (page < numPages) {
        return page + 1;
      }

      return page;
    });
  }

  function previousPage() {
    setPageNumber((page) => {
      if (page > 1) {
        return page - 1;
      }

      return page;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}

      <div
        className="
        flex
        items-center
        justify-between
        rounded-3xl
        bg-white/70
        p-4
        shadow
      "
      >
        <button
          onClick={previousPage}
          className="
          rounded-2xl
          bg-blue-600
          p-3
          text-white
          "
        >
          <ChevronLeft />
        </button>

        <div className="text-center">
          <p className="font-black">
            Page {pageNumber} / {numPages || "--"}
          </p>
        </div>

        <button
          onClick={nextPage}
          className="
          rounded-2xl
          bg-blue-600
          p-3
          text-white
          "
        >
          <ChevronRight />
        </button>
      </div>

      {/* Zoom */}

      <div
        className="
        flex
        justify-center
        gap-3
      "
      >
        <button
          onClick={() => setScale((s) => Math.max(0.7, s - 0.2))}
          className="
          rounded-xl
          bg-white
          p-3
          shadow
          "
        >
          <ZoomOut />
        </button>

        <button
          onClick={() => setScale((s) => Math.min(2, s + 0.2))}
          className="
          rounded-xl
          bg-white
          p-3
          shadow
          "
        >
          <ZoomIn />
        </button>
      </div>

      {/* PDF */}

      <div
        className="
        flex
        justify-center
        overflow-auto
        rounded-3xl
        bg-slate-200
        p-5
        "
      >
        <Document
          file="/books/class6-english-for-today.pdf"
          onLoadSuccess={onLoadSuccess}
          loading={<p className="font-bold">Loading textbook...</p>}
        >
          <Page pageNumber={pageNumber} scale={scale} />
        </Document>
      </div>
    </div>
  );
}
