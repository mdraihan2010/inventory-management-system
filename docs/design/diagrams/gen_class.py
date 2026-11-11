# Generates class-diagram.dot from a compact description of the Mongoose models
F = 'Latin Modern Roman,10 Regular'
classes = {
 # name: (stereotype, attributes, operations)
 'User': ('model', ['name: String', 'email: String {unique}', 'passwordHash: String', 'role: Role', 'isActive: Boolean', 'mustChangePassword: Boolean'],
          ['login(email, password): JWT', 'changePassword(old, new)']),
 'Category': ('model', ['name: String {unique}', 'description: String', 'isActive: Boolean'], []),
 'Brand': ('model', ['name: String {unique}', 'description: String', 'isActive: Boolean'], []),
 'Product': ('model', ['name: String', 'sku: String {unique}', 'barcode: String', 'purchasePrice: Number', 'sellingPrice: Number',
                       'currentStock: Number', 'minStockLevel: Number', 'unit: String', 'isActive: Boolean'],
             ['adjustStock(type, qty, reason)', 'stockState(): OK | LOW | OUT']),
 'Customer': ('model', ['name: String', 'phone: String', 'email: String', 'address: String', 'notes: String', 'isActive: Boolean'], []),
 'Supplier': ('model', ['name: String', 'companyName: String', 'phone: String', 'email: String', 'address: String', 'isActive: Boolean'], []),
 'Sale': ('model', ['saleNumber: String {unique}', 'saleDate: Date', 'subtotal: Number', 'discount: Number', 'grandTotal: Number',
                    'paidAmount: Number', 'outstandingAmount: Number', 'returnedAmount: Number', 'paymentStatus: PaymentStatus',
                    'status: DocStatus', 'walkInPaymentMethod: PaymentMethod'],
          ['complete()', 'cancel()', 'addPayment(amount, method)']),
 'SaleItem': ('embedded', ['productName: String', 'sku: String', 'quantity: Number', 'unitPrice: Number', 'lineTotal: Number', 'costPrice: Number'], []),
 'Purchase': ('model', ['purchaseNumber: String {unique}', 'purchaseDate: Date', 'subtotal: Number', 'discount: Number', 'grandTotal: Number',
                        'paidAmount: Number', 'returnedAmount: Number', 'status: DocStatus'],
              ['complete()', 'cancel()', 'paySupplier(amount, method)', 'outstanding(): Number']),
 'PurchaseItem': ('embedded', ['productName: String', 'sku: String', 'quantity: Number', 'unitPrice: Number', 'lineTotal: Number'], []),
 'Payment': ('model', ['amount: Number', 'method: PaymentMethod', 'reference: String', 'createdAt: Date'], []),
 'SupplierPayment': ('model', ['amount: Number', 'method: PaymentMethod', 'reference: String', 'createdAt: Date'], []),
 'Return': ('model', ['returnNumber: String {unique}', 'kind: CUSTOMER | SUPPLIER', 'totalValue: Number', 'creditApplied: Number',
                      'cashRefund: Number', 'refundMethod: PaymentMethod', 'reason: String', 'status: ACTIVE | CANCELLED', 'cancelReason: String'],
            ['cancel(reason)']),
 'ReturnItem': ('embedded', ['productName: String', 'sku: String', 'quantity: Number', 'unitPrice: Number', 'lineTotal: Number', 'costPrice: Number'], []),
 'StockMovement': ('model', ['type: MovementType', 'change: Number', 'previousStock: Number', 'resultingStock: Number', 'reason: String', 'createdAt: Date'], []),
 'AuditLog': ('model', ['action: String', 'entityType: String', 'entityId: String', 'summary: String', 'createdAt: Date'], []),
}
enums = {
 'Role': ['ADMINISTRATOR', 'MANAGER', 'STAFF'],
 'DocStatus': ['DRAFT', 'COMPLETED', 'CANCELLED'],
 'PaymentStatus': ['PAID', 'PARTIALLY_PAID', 'UNPAID'],
 'PaymentMethod': ['CASH', 'MOBILE_BANKING', 'CARD', 'BANK_TRANSFER'],
 'MovementType': ['OPENING_STOCK', 'PURCHASE', 'SALE', 'CUSTOMER_RETURN', 'SUPPLIER_RETURN', 'DAMAGED', 'ADJUSTMENT', 'RETURN_CANCELLED'],
}
def esc(t): return t.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')
def box(name, stereo, attrs, ops, fill):
    head = f'<TR><TD BGCOLOR="{fill}"><FONT POINT-SIZE="9"><I>&laquo;{stereo}&raquo;</I></FONT><BR/><B>{name}</B></TD></TR>'
    a = '<BR ALIGN="LEFT"/>'.join('+ ' + esc(x) for x in attrs) + '<BR ALIGN="LEFT"/>'
    rows = head + f'<TR><TD ALIGN="LEFT" BALIGN="LEFT">{a}</TD></TR>'
    if stereo != 'enumeration':
        o = ('<BR ALIGN="LEFT"/>'.join('+ ' + esc(x) for x in ops) + '<BR ALIGN="LEFT"/>') if ops else ' '
        rows += f'<TR><TD ALIGN="LEFT" BALIGN="LEFT">{o}</TD></TR>'
    return f'  {name} [label=<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="4">{rows}</TABLE>>];\n'

out = ['// Class Diagram: StockPilot. Generated from the Mongoose models in server/src/models by gen_class.py',
       '// Render: dot -Tpdf class-diagram.dot -o class-diagram.pdf',
       'digraph ClassDiagram {',
       f'  graph [rankdir=TB, fontname="{F}", nodesep=0.45, ranksep=0.7, splines=ortho, pad=0.2];',
       f'  node [shape=plain, fontname="{F}", fontsize=10];',
       f'  edge [fontname="{F}", fontsize=9, arrowsize=0.8, color="#333333"];']
for n,(st,a,o) in classes.items():
    out.append(box(n, 'Mongoose model' if st=='model' else 'embedded document', a, o, '#e8eefc' if st=='model' else '#f3f3f3'))
for n,v in enums.items():
    out.append(box(n, 'enumeration', v, [], '#fff6e0'))

# associations: (a, b, a_mult, b_mult, label, kind)
assoc = [
 ('Category','Product','1','0..*','classifies','assoc'),
 ('Brand','Product','1','0..*','makes','assoc'),
 ('Supplier','Purchase','1','0..*','supplies','assoc'),
 ('Customer','Sale','0..1','0..*','buys','assoc'),
 ('Sale','SaleItem','1','1..*','','comp'),
 ('Purchase','PurchaseItem','1','1..*','','comp'),
 ('Return','ReturnItem','1','1..*','','comp'),
 ('SaleItem','Product','0..*','1','','assoc'),
 ('PurchaseItem','Product','0..*','1','','assoc'),
 ('ReturnItem','Product','0..*','1','','assoc'),
 ('Sale','Payment','1','0..*','paid by','assoc'),
 ('Purchase','SupplierPayment','1','0..*','paid by','assoc'),
 ('Sale','Return','0..1','0..*','customer return','assoc'),
 ('Purchase','Return','0..1','0..*','supplier return','assoc'),
 ('Product','StockMovement','1','0..*','history','assoc'),
 ('User','AuditLog','1','0..*','performs','assoc'),
]
for a,b,ma,mb,lab,k in assoc:
    attrs = [f'taillabel=" {ma} "', f'headlabel=" {mb} "']
    if lab: attrs.append(f'xlabel="{lab}"')
    if k=='comp': attrs += ['dir=both','arrowtail=diamond','arrowhead=none']
    else: attrs += ['arrowhead=none']
    out.append(f'  {a} -> {b} [{", ".join(attrs)}];')
# enum usage (dependency) kept light
for a,b in [('User','Role'),('Sale','DocStatus'),('Sale','PaymentStatus'),('Payment','PaymentMethod'),('StockMovement','MovementType')]:
    out.append(f'  {a} -> {b} [style=dashed, arrowhead=vee, color="#888888"];')
out.append('  { rank=same; ' + '; '.join(enums) + '; }')
out.append('  { rank=same; Category; Brand; }')
out.append('  note [shape=note, style=filled, fillcolor="#fffbe6", fontsize=9, label="Sale, Purchase, Payment, SupplierPayment,\\nReturn and StockMovement also store\\ncreatedBy: User (who did it)."];')
out.append('  note -> User [style=dotted, arrowhead=none, color="#888888"];')
out.append('}')
open('class-diagram.dot','w').write('\n'.join(out)+'\n')
