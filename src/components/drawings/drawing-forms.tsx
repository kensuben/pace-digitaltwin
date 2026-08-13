"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

async function responseError(response: Response) {
  const payload = (await response.json()) as {
    errors?: Array<{ message: string }>;
  };
  return payload.errors?.[0]?.message ?? "Request failed.";
}

export function CreateDrawingForm({
  locations,
}: {
  locations: Array<{ campusId: string; buildingId: string; label: string }>;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function submit(formData: FormData) {
    const location = locations.find(
      (item) => item.buildingId === formData.get("buildingId"),
    );
    if (!location) return;
    const response = await fetch("/api/drawings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campusId: location.campusId,
        buildingId: location.buildingId,
        name: formData.get("name"),
        documentType: formData.get("documentType"),
        uploadedBy: "local-admin",
      }),
    });
    if (!response.ok) return setMessage(await responseError(response));
    const payload = (await response.json()) as { data: { id: string } };
    router.push(`/drawings/${payload.data.id}`);
  }
  return (
    <form action={submit} className="grid gap-3 md:grid-cols-4">
      <input
        className="rounded-md border bg-background p-2"
        name="name"
        placeholder="Drawing name"
        required
      />
      <select
        className="rounded-md border bg-background p-2"
        name="buildingId"
        required
      >
        {locations.map((item) => (
          <option key={item.buildingId} value={item.buildingId}>
            {item.label}
          </option>
        ))}
      </select>
      <select
        className="rounded-md border bg-background p-2"
        name="documentType"
      >
        <option value="FLOOR_PLAN">Floor plan</option>
        <option value="NETWORK">Network</option>
        <option value="ELV">ELV</option>
        <option value="CCTV">CCTV</option>
        <option value="WIFI">Wi-Fi</option>
        <option value="RISER">Riser</option>
        <option value="OTHER">Other</option>
      </select>
      <Button type="submit">Create document</Button>
      {message && (
        <p className="text-sm text-destructive md:col-span-4">{message}</p>
      )}
    </form>
  );
}

export function UploadRevisionForm({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(formData: FormData) {
    setBusy(true);
    const response = await fetch(`/api/drawings/${documentId}/revisions`, {
      method: "POST",
      body: formData,
    });
    setBusy(false);
    if (!response.ok) return setMessage(await responseError(response));
    setMessage("Upload thành công; worker sẽ xử lý job đã queue.");
    router.refresh();
  }
  return (
    <form action={submit} className="grid gap-3 md:grid-cols-[10rem_1fr_auto]">
      <input
        className="rounded-md border bg-background p-2"
        name="revisionCode"
        placeholder="Revision, e.g. R1"
        required
      />
      <input
        accept="application/pdf,.pdf"
        className="rounded-md border bg-background p-2"
        name="file"
        required
        type="file"
      />
      <Button disabled={busy} type="submit">
        {busy ? "Uploading…" : "Upload PDF"}
      </Button>
      {message && (
        <p className="text-sm text-muted-foreground md:col-span-3">{message}</p>
      )}
    </form>
  );
}

export function FloorMappingForm({
  pageId,
  buildingId,
  currentFloorId,
  floors,
}: {
  pageId: string;
  buildingId: string;
  currentFloorId: string | null;
  floors: Array<{ id: string; code: string; name: string }>;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function submit(formData: FormData) {
    const response = await fetch(`/api/drawing-pages/${pageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buildingId, floorId: formData.get("floorId") }),
    });
    if (!response.ok) return setMessage(await responseError(response));
    setMessage("Mapped");
    router.refresh();
  }
  return (
    <form action={submit} className="flex items-center gap-2">
      <select
        className="min-w-36 rounded-md border bg-background p-2"
        defaultValue={currentFloorId ?? ""}
        name="floorId"
        required
      >
        <option disabled value="">
          Select floor
        </option>
        {floors.map((floor) => (
          <option key={floor.id} value={floor.id}>
            {floor.code} — {floor.name}
          </option>
        ))}
      </select>
      <Button size="sm" type="submit">
        Map
      </Button>
      <span className="text-xs text-primary">{message}</span>
    </form>
  );
}
