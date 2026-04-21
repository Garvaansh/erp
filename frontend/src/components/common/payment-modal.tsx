"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { LogPaymentPayload, PayablePO } from "@/types/finance";

type PaymentModalProps = {
  open: boolean;
  po: PayablePO | null;
  vendorName?: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: LogPaymentPayload) => Promise<void>;
  isSubmitting?: boolean;
};

type PaymentModalFormProps = {
  po: PayablePO;
  vendorName?: string;
  onCancel: () => void;
  onSubmit: (payload: LogPaymentPayload) => Promise<void>;
  isSubmitting: boolean;
};

function PaymentModalForm({
  po,
  vendorName,
  onCancel,
  onSubmit,
  isSubmitting,
}: PaymentModalFormProps) {
  const [amount, setAmount] = useState(po.due > 0 ? po.due.toFixed(2) : "");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [note, setNote] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Enter a valid payment amount.");
      return;
    }

    setErrorMessage("");

    await onSubmit({
      po_id: po.po_id,
      amount: parsedAmount,
      payment_date: paymentDate || undefined,
      note: note.trim() || undefined,
    });
  }

  return (
    <DialogContent className="sm:max-w-md">
      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <DialogHeader>
          <DialogTitle>Log Payment</DialogTitle>
          <DialogDescription>
            {`Record a payment for ${po.po_number}${vendorName ? ` from ${vendorName}` : ""}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="payment-amount">Amount</Label>
          <Input
            id="payment-amount"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment-date">Payment Date</Label>
          <Input
            id="payment-date"
            type="date"
            value={paymentDate}
            onChange={(event) => setPaymentDate(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment-note">Note</Label>
          <Textarea
            id="payment-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional payment note"
          />
        </div>

        {errorMessage ? (
          <p className="text-sm text-destructive">{errorMessage}</p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Submit Payment
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export function PaymentModal({
  open,
  po,
  vendorName,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
}: PaymentModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && po ? (
        <PaymentModalForm
          key={po.po_id}
          po={po}
          vendorName={vendorName}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
        />
      ) : null}
    </Dialog>
  );
}
