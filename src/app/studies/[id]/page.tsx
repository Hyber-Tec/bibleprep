import StudyDetail from "@/components/StudyDetail";

// Study ids only exist at run time, so the build makes one placeholder page. Firebase Hosting serves it
// for every /studies/<id> (the rewrite in firebase.json) and StudyDetail reads the id from the address.
export function generateStaticParams() {
  return [{ id: "_" }];
}

export default function StudyPage() {
  return <StudyDetail />;
}
