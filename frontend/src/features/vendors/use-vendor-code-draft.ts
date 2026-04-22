import { useEffect, useState } from "react";
import { deriveVendorCodeFromName, sanitizeVendorCode } from "./vendor-code";

export function useVendorCodeDraft(initialName = "") {
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(deriveVendorCodeFromName(initialName));
  const [isCodeDirty, setIsCodeDirty] = useState(false);

  useEffect(() => {
    if (isCodeDirty) {
      return;
    }
    const timeoutId = setTimeout(() => {
      setCode(deriveVendorCodeFromName(name));
    }, 800);
    return () => clearTimeout(timeoutId);
  }, [name, isCodeDirty]);

  function onNameChange(nextName: string) {
    setName(nextName);
  }

  function onNameBlur() {
    if (isCodeDirty) {
      return;
    }
    setCode(deriveVendorCodeFromName(name));
  }

  function onCodeChange(nextCode: string) {
    setIsCodeDirty(true);
    setCode(sanitizeVendorCode(nextCode));
  }

  return {
    name,
    code,
    isCodeDirty,
    onNameChange,
    onNameBlur,
    onCodeChange,
    resetDraft: () => {
      setName("");
      setCode("");
      setIsCodeDirty(false);
    },
  };
}
