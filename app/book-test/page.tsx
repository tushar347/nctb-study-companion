import PdfBookViewer from "@/components/reader/PdfBookViewer";

export default function BookTest() {
  return (
    <main
      className="
min-h-screen
bg-slate-100
p-10
"
    >
      <h1
        className="
mb-6
text-4xl
font-black
"
      >
        Class 6 English Book Reader
      </h1>

      <PdfBookViewer />
    </main>
  );
}
