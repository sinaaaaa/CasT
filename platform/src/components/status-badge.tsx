import { AttemptStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

export function StatusBadge({ status, passed }: { status: AttemptStatus; passed?: boolean }) {
  if (status === AttemptStatus.CORRECT || passed) {
    return (
      <Badge variant="success" className="gap-1 shadow-sm">
        <CheckCircle2 className="h-3 w-3" />
        Correct
      </Badge>
    );
  }
  if (status === AttemptStatus.INCORRECT) {
    return (
      <Badge variant="danger" className="gap-1 shadow-sm">
        <XCircle className="h-3 w-3" />
        Incorrect
      </Badge>
    );
  }
  return (
    <Badge variant="warning" className="gap-1 shadow-sm">
      <Clock className="h-3 w-3" />
      Incomplete
    </Badge>
  );
}
