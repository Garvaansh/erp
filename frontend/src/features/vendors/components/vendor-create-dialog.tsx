"use client";

import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateVendor } from "@/features/vendors/mutations";
import { useVendorCodeDraft } from "@/features/vendors/use-vendor-code-draft";

type VendorCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function VendorCreateDialog({
  open,
  onOpenChange,
}: VendorCreateDialogProps) {
  const createMutation = useCreateVendor();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstin, setGstin] = useState("");
  const [error, setError] = useState("");
  const codeDraft = useVendorCodeDraft("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const trimmedName = codeDraft.name.trim();
    const trimmedCode = codeDraft.code.trim();
    if (!trimmedName || !trimmedCode) {
      setError("Name and code are required.");
      return;
    }

    createMutation.mutate(
      {
        name: trimmedName,
        code: trimmedCode,
        phone: phone.trim(),
        email: email.trim(),
        gstin: gstin.trim(),
      },
      {
        onSuccess: () => {
          codeDraft.resetDraft();
          setPhone("");
          setEmail("");
          setGstin("");
          onOpenChange(false);
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : "Failed to create vendor.");
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Vendor</DialogTitle>
          <DialogDescription>
            Add a supplier quickly. Code auto-generates from name and stays editable.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="vendor-name">Name</Label>
            <Input
              id="vendor-name"
              value={codeDraft.name}
              onChange={(event) => codeDraft.onNameChange(event.target.value)}
              onBlur={codeDraft.onNameBlur}
              placeholder="Acme Steels"
              required
            />
            </div>
            <div className="space-y-2">
            <Label htmlFor="vendor-code">Code</Label>
            <Input
              id="vendor-code"
              value={codeDraft.code}
              onChange={(event) => codeDraft.onCodeChange(event.target.value)}
              placeholder="ACMES"
              required
            />
            </div>
            <div className="space-y-2">
            <Label htmlFor="vendor-phone">Phone (optional)</Label>
            <Input
              id="vendor-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+91..."
            />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-email">Email (optional)</Label>
              <Input
                id="vendor-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="accounts@vendor.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-gstin">GSTIN (optional)</Label>
              <Input
                id="vendor-gstin"
                value={gstin}
                onChange={(event) => setGstin(event.target.value)}
                placeholder="22AAAAA0000A1Z5"
              />
            </div>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Vendor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
