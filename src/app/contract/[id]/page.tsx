import { auth, database } from "@/lib/firebase";
import TodoContract from "@/components/TodoContract";

export default function ContractPage({ params }: { params: { id: string } }) {
  return (
    <TodoContract
      database={database}
      isBaseUrl={false}
      contractId={params.id}
    />
  );
}
