"use client";

import { ArrowLeft, Plus, X } from "lucide-react";
import { useState } from "react";

import {
  CreateDeviceForm,
  type LocationOption,
} from "@/components/inventory/create-device-form";
import { CreateModelForm } from "@/components/catalog/create-model-form";
import { Button } from "@/components/ui/button";

interface CreateDeviceDialogProps {
  scenarios: Array<{ id: string; name: string; isLocked: boolean }>;
  models: Array<{ id: string; sku: string; modelName: string }>;
  locations: LocationOption[];
  vendors: Array<{ id: string; name: string }>;
}

export function CreateDeviceDialog(props: CreateDeviceDialogProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"DEVICE" | "MODEL">("DEVICE");
  const [models, setModels] = useState(props.models);
  const [selectedModelId, setSelectedModelId] = useState("");

  return (
    <>
      <Button
        size="lg"
        onClick={() => {
          setView("DEVICE");
          setOpen(true);
        }}
      >
        <Plus size={18} />
        Thêm thiết bị
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            aria-labelledby="create-inventory-device-title"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-primary/30 bg-card p-6 shadow-2xl"
            role="dialog"
          >
            <div className="mb-5 flex items-start justify-between gap-4 border-b pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                  {view === "DEVICE" ? "Inventory" : "Device Catalog"}
                </p>
                <h2
                  className="mt-1 text-xl font-bold"
                  id="create-inventory-device-title"
                >
                  {view === "DEVICE" ? "Thêm thiết bị mới" : "Tạo Custom Model"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {view === "DEVICE"
                    ? "Chọn model và vị trí; port sẽ được sinh tự động từ Device Catalog."
                    : "Khai báo model và port profile để sử dụng ngay trong Inventory."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {view === "DEVICE" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setView("MODEL")}
                  >
                    <Plus size={15} /> Model mới
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setView("DEVICE")}
                  >
                    <ArrowLeft size={15} /> Quay lại thiết bị
                  </Button>
                )}
                <button
                  aria-label="Đóng hộp thoại thêm thiết bị"
                  className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  <X size={19} />
                </button>
              </div>
            </div>
            {view === "DEVICE" ? (
              <CreateDeviceForm
                key={selectedModelId}
                defaultModelId={selectedModelId || undefined}
                locations={props.locations}
                models={models}
                scenarios={props.scenarios}
                onCreated={() => setOpen(false)}
              />
            ) : (
              <CreateModelForm
                vendors={props.vendors}
                onCreated={(model) => {
                  setModels((current) => [...current, model]);
                  setSelectedModelId(model.id);
                  setView("DEVICE");
                }}
              />
            )}
          </section>
        </div>
      )}
    </>
  );
}
