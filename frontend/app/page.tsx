import { FeaturesStrip } from "@/components/features-strip";
import { UploadZone } from "@/components/upload-zone";

export default function HomePage() {
  return (
    <div className="screen">
      <div className="upload-hero">
        <h1>
          Catch Excel issues <em>before</em>
          <br />
          they become pipeline failures.
        </h1>
        <p>
          Sheetlint is a pre-handoff quality inspector for messy, human-entered
          spreadsheets. Drop a file, run the detector stack, get a ranked report
          in seconds.
        </p>
      </div>

      <UploadZone />

      <FeaturesStrip />
    </div>
  );
}
