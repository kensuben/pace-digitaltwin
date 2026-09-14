"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DeviceCategory } from "@/generated/prisma/enums";

interface CreateModelFormProps {
  vendors: Array<{ id: string; name: string }>;
  onCreated?: (model: { id: string; sku: string; modelName: string }) => void;
}

export function CreateModelForm({ vendors, onCreated }: CreateModelFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [vendorOptions, setVendorOptions] = useState(vendors);
  const [selectedVendorId, setSelectedVendorId] = useState(vendors[0]?.id ?? "");
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSubmitting(true);
    setMessage("");
    const form = new FormData(formElement);
    const speeds = String(form.get("speeds"))
      .split(",")
      .map((value) => Number(value.trim()))
      .filter(Number.isFinite);
    const response = await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendorId: form.get("vendorId"),
        category: form.get("category"),
        sku: form.get("sku"),
        modelName: form.get("modelName"),
        formFactor: form.get("formFactor") || null,
        rackUnits: form.get("rackUnits") ? Number(form.get("rackUnits")) : null,
        portProfiles: [
          {
            portGroup: "DEFAULT",
            count: Number(form.get("count")),
            media: form.get("media"),
            supportedSpeedsMbps: speeds,
            namePrefix: form.get("namePrefix"),
            startNumber: 1,
            sortOrder: 10,
          },
        ],
      }),
    });
    const result = (await response.json()) as {
      data?: { id: string; sku: string; modelName: string };
      errors?: Array<{ message: string }>;
    };
    setSubmitting(false);
    if (!response.ok) {
      setMessage(result.errors?.[0]?.message ?? "Không thể tạo model.");
      return;
    }
    formElement.reset();
    setMessage("Đã tạo custom model.");
    router.refresh();
    if (result.data) onCreated?.(result.data);
  }

  function vendorCreated(vendor: { id: string; name: string }) {
    setVendorOptions((current) => [...current, vendor].sort((left, right) => left.name.localeCompare(right.name)));
    setSelectedVendorId(vendor.id);
    setVendorDialogOpen(false);
    setMessage(`Đã tạo Vendor ${vendor.name} và chọn cho model mới.`);
    router.refresh();
  }

  return <div>
    <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
      <label className="grid gap-1.5 text-sm">
        <span className="flex items-center justify-between gap-3"><span>Vendor</span><button className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-primary hover:bg-primary/10" onClick={() => setVendorDialogOpen(true)} type="button"><Plus size={14}/>Tạo Vendor</button></span>
        <select
          className="rounded-md border bg-background p-2"
          name="vendorId"
          onChange={(event) => setSelectedVendorId(event.target.value)}
          required
          value={selectedVendorId}
        >
          {vendorOptions.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Category
        <select
          className="rounded-md border bg-background p-2"
          name="category"
          required
        >
          {Object.values(DeviceCategory).map((category) => (
            <option key={category} value={category}>
              {category.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        SKU
        <input
          className="rounded-md border bg-background p-2"
          name="sku"
          required
        />
      </label>
      <label className="grid gap-1 text-sm">
        Model name
        <input
          className="rounded-md border bg-background p-2"
          name="modelName"
          required
        />
      </label>
      <label className="grid gap-1 text-sm">
        Form factor
        <input
          className="rounded-md border bg-background p-2"
          name="formFactor"
          placeholder="1U"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Rack units
        <input
          className="rounded-md border bg-background p-2"
          min="1"
          name="rackUnits"
          type="number"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Port media
        <select className="rounded-md border bg-background p-2" name="media">
          <option value="RJ45">RJ45</option>
          <option value="SFP">SFP</option>
          <option value="SFP_PLUS">SFP+</option>
          <option value="SFP28">SFP28</option>
          <option value="QSFP28">QSFP28</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        Port count
        <input
          className="rounded-md border bg-background p-2"
          defaultValue="1"
          min="1"
          name="count"
          required
          type="number"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Port prefix
        <input
          className="rounded-md border bg-background p-2"
          defaultValue="port"
          name="namePrefix"
          required
        />
      </label>
      <label className="grid gap-1 text-sm">
        Speeds Mbps, comma-separated
        <input
          className="rounded-md border bg-background p-2"
          defaultValue="1000"
          name="speeds"
          required
        />
      </label>
      <div className="flex items-center gap-3 md:col-span-2">
        <Button disabled={submitting} type="submit">
          {submitting ? "Đang tạo…" : "Tạo Model mới"}
        </Button>
        <span aria-live="polite" className="text-sm text-muted-foreground">
          {message}
        </span>
      </div>
    </form>
    {vendorDialogOpen && (
      <CreateVendorDialog
        onClose={() => setVendorDialogOpen(false)}
        onCreated={vendorCreated}
      />
    )}
  </div>;
}

function CreateVendorDialog({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (vendor: { id: string; name: string }) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: form.get("code"), name: form.get("name"), website: form.get("website") }),
    });
    const result = (await response.json()) as {
      data?: { id: string; name: string };
      errors?: Array<{ message: string }>;
    };
    setSubmitting(false);
    if (!response.ok || !result.data) {
      setError(result.errors?.[0]?.message ?? "Không thể tạo Vendor.");
      return;
    }
    onCreated(result.data);
  }

  return <div aria-labelledby="create-vendor-title" aria-modal="true" className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="w-full max-w-lg rounded-2xl border bg-card p-5 shadow-2xl sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Device Catalog</p><h2 className="mt-1 text-2xl font-bold" id="create-vendor-title">Tạo Vendor mới</h2><p className="mt-2 text-sm text-muted-foreground">Vendor mới sẽ được chọn ngay cho Custom Model đang nhập.</p></div><button aria-label="Đóng" className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground hover:text-foreground" onClick={onClose} type="button"><X size={18}/></button></div>
      <form className="mt-6 grid gap-4" onSubmit={submit}>
        <label className="grid gap-1.5 text-sm font-medium">Mã Vendor<input autoFocus className="border bg-background px-3" maxLength={40} name="code" pattern="[A-Za-z0-9][A-Za-z0-9_-]*" placeholder="Ví dụ: CISCO" required/><span className="text-xs font-normal text-muted-foreground">Chữ, số, dấu gạch ngang hoặc gạch dưới; hệ thống tự viết hoa.</span></label>
        <label className="grid gap-1.5 text-sm font-medium">Tên Vendor<input className="border bg-background px-3" maxLength={120} name="name" placeholder="Ví dụ: Cisco" required/></label>
        <label className="grid gap-1.5 text-sm font-medium">Website <span className="text-muted-foreground">(không bắt buộc)</span><input className="border bg-background px-3" name="website" placeholder="https://www.cisco.com" type="url"/></label>
        {error && <p aria-live="polite" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end"><Button onClick={onClose} type="button" variant="outline">Hủy</Button><Button disabled={submitting} type="submit">{submitting ? "Đang tạo…" : "Tạo Vendor"}</Button></div>
      </form>
    </div>
  </div>;
}
