import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "../../src/client/App";
import { fetchMoveRequests, fetchPublicVehicle, fetchVehicles } from "../../src/client/api";

vi.mock("../../src/client/api", () => ({
  fetchMoveRequests: vi.fn(),
  fetchPublicVehicle: vi.fn(),
  fetchVehicles: vi.fn(),
  notifyOwner: vi.fn()
}));

describe("App", () => {
  it("shows an error when a scanned vehicle cannot be loaded", async () => {
    window.history.pushState({}, "", "/c/missing-code");
    vi.mocked(fetchPublicVehicle).mockRejectedValue(new Error("车辆不存在或已停用"));
    vi.mocked(fetchVehicles).mockResolvedValue([]);
    vi.mocked(fetchMoveRequests).mockResolvedValue([]);

    render(<App />);

    await waitFor(() => expect(screen.getByText("车辆不存在或已停用")).toBeInTheDocument());
  });
});
