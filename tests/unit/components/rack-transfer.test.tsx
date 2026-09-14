/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  availableRackUnits,
  RackTransfer,
} from "@/components/racks/rack-transfer";

afterEach(cleanup);
const device = {
  id: "server",
  hostname: "SERVER",
  rackUnits: 2,
  rackUnitStart: 1,
};
const racks = [
  { id: "a", code: "RACK-A", name: "Rack A", rackUnits: 4, devices: [device] },
  {
    id: "b",
    code: "RACK-B",
    name: "Rack B",
    rackUnits: 4,
    devices: [
      { id: "other", hostname: "OTHER", rackUnits: 2, rackUnitStart: 1 },
    ],
  },
];
it("computes contiguous free space per rack, excluding the moving device", () => {
  expect(availableRackUnits(racks[0], device)).toEqual([1, 2, 3]);
  expect(availableRackUnits(racks[1], device)).toEqual([3]);
});
it("sends the explicitly selected destination rack and valid U position", () => {
  const onPlace = vi.fn();
  render(
    <RackTransfer
      device={device}
      racks={racks}
      disabled={false}
      onPlace={onPlace}
    />,
  );
  fireEvent.change(screen.getByLabelText("Tủ rack đích"), {
    target: { value: "b" },
  });
  expect(screen.getByLabelText("Vị trí U bắt đầu")).toHaveValue("3");
  fireEvent.click(screen.getByRole("button", { name: "Lưu vị trí rack" }));
  expect(onPlace).toHaveBeenCalledWith("b", 3);
});
it("prevents placement when no contiguous space fits", () => {
  render(
    <RackTransfer
      device={{ ...device, rackUnits: 3 }}
      racks={[racks[1]]}
      disabled={false}
      onPlace={vi.fn()}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Lưu vị trí rack" }),
  ).toBeDisabled();
});
