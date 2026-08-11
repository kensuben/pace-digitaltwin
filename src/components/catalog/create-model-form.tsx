"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

interface CreateModelFormProps {
  vendors: Array<{ id: string; name: string }>;
}

export function CreateModelForm({ vendors }: CreateModelFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
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
      errors?: Array<{ message: string }>;
    };
    setSubmitting(false);
    if (!response.ok) {
      setMessage(result.errors?.[0]?.message ?? "Không thể tạo model.");
      return;
    }
    event.currentTarget.reset();
    setMessage("Đã tạo custom model.");
    router.refresh();
  }

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
      <label className="grid gap-1 text-sm">
        Vendor
        <select
          className="rounded-md border bg-background p-2"
          name="vendorId"
          required
        >
          {vendors.map((vendor) => (
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
          <option value="CORE_SWITCH">Core switch</option>
          <option value="ACCESS_SWITCH">Access switch</option>
          <option value="FIREWALL">Firewall</option>
          <option value="SERVER">Server</option>
          <option value="OTHER">Other</option>
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
          {submitting ? "Đang tạo…" : "Create custom model"}
        </Button>
        <span aria-live="polite" className="text-sm text-muted-foreground">
          {message}
        </span>
      </div>
    </form>
  );
}
