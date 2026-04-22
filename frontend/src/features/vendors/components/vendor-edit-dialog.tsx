"use client";

import { useState, type FormEvent } from "react";
import type { Vendor } from "@/features/vendors/types";
import { useUpdateVendor } from "@/features/vendors/mutations";
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
import { Textarea } from "@/components/ui/textarea";

type VendorEditDialogProps = {
  vendor: Vendor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function VendorEditDialog({
  vendor,
  open,
  onOpenChange,
}: VendorEditDialogProps) {
  const updateMutation = useUpdateVendor();
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    updateMutation.mutate(
      {
        id: vendor.id,
        payload: {
          name: String(form.get("name") ?? "").trim(),
          contact_person: String(form.get("contact_person") ?? "").trim(),
          phone: String(form.get("phone") ?? "").trim(),
          email: String(form.get("email") ?? "").trim(),
          gstin: String(form.get("gstin") ?? "").trim(),
          notes: String(form.get("notes") ?? "").trim(),
          is_active: form.get("is_active") === "on",
        },
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => {
          setError(err instanceof Error ? err.message : "Failed to update vendor.");
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Vendor</DialogTitle>
          <DialogDescription>
            Update vendor details. Vendor code remains immutable.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" name="name" defaultValue={vendor.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-code">Code</Label>
              <Input id="edit-code" value={vendor.code} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input id="edit-phone" name="phone" defaultValue={vendor.phone} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-contact-person">Contact Person</Label>
              <Input id="edit-contact-person" name="contact_person" defaultValue={vendor.contact_person} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" name="email" defaultValue={vendor.email} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-gstin">GSTIN</Label>
              <Input id="edit-gstin" name="gstin" defaultValue={vendor.gstin} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea id="edit-notes" name="notes" defaultValue={vendor.notes} rows={4} />
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input name="is_active" type="checkbox" defaultChecked={vendor.is_active} />
            Vendor is active
          </label>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
