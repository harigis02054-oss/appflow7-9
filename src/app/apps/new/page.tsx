import { Suspense } from "react";
import NewAppForm from "./NewAppForm";

export default function NewAppPage() {
  return (
    <Suspense fallback={null}>
      <NewAppForm />
    </Suspense>
  );
}
