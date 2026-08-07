import { FontLibrarySidebar } from "@/components/FontLibrarySidebar";
import { PreviewPane } from "@/components/PreviewPane";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col md:h-screen md:flex-row md:overflow-hidden">
      <FontLibrarySidebar />
      <PreviewPane />
    </div>
  );
}
