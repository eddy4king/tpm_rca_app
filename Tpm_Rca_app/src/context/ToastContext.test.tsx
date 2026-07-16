import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "./ToastContext";

function Harness() {
  const toast = useToast();
  return (
    <button onClick={() => toast.success("Saved!")}>fire</button>
  );
}

describe("ToastProvider", () => {
  it("shows a toast when triggered", async () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>
    );

    expect(screen.queryByText("Saved!")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("fire"));
    expect(screen.getByText("Saved!")).toBeInTheDocument();
  });

  it("dismisses a toast via its close button", async () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>
    );
    await userEvent.click(screen.getByText("fire"));
    const dismiss = screen.getByLabelText("Dismiss notification");
    await act(async () => {
      await userEvent.click(dismiss);
    });
    expect(screen.queryByText("Saved!")).not.toBeInTheDocument();
  });
});
