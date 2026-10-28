# DOM owned by an editor

Add `data-sao-preserve-children="true"` to an otherwise empty host when a rich-text editor or another controller owns its child nodes. Saola still reconciles the host's attributes and events, but does not render or remove its children. This preserves text nodes, IME composition, selection and external event listeners during parent state updates.

Do not put Saola-managed children or output bindings inside the host. The owner must initialize its contents and dispose its listeners when the view unmounts. Normal elements retain their existing reconciliation behavior. This is an ownership boundary, not HTML sanitization: validate the editor's structured document and render untrusted text safely.
