/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders an accessible button and forwards native props", () => {
    render(<Button disabled>Lưu thay đổi</Button>);

    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
  });

  it("merges Tailwind classes from the caller", () => {
    render(<Button className="px-8">Mở sơ đồ</Button>);

    expect(screen.getByRole("button", { name: "Mở sơ đồ" })).toHaveClass(
      "px-8",
    );
  });
});
