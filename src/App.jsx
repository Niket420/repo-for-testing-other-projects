import React, { useState, useEffect } from 'react';
import './App.css';
import { jsPDF } from 'jspdf';

const defaultMenu = [
  { id: 1, name: 'Paneer Butter Masala', category: 'Main', price: 250 },
  { id: 2, name: 'Chicken Biryani', category: 'Main', price: 300 },
  { id: 3, name: 'Dal Makhani', category: 'Main', price: 200 },
  { id: 4, name: 'Masala Dosa', category: 'Breakfast', price: 150 },
  { id: 5, name: 'Samosa (2 pcs)', category: 'Snacks', price: 80 },
  { id: 6, name: 'Gulab Jamun (2 pcs)', category: 'Dessert', price: 70 },
  { id: 7, name: 'Mutton Rogan Josh', category: 'Main', price: 350 },
  { id: 8, name: 'Paneer Tikka', category: 'Appetizer', price: 180 },
  { id: 9, name: 'Lassi (Mango)', category: 'Beverage', price: 90 },
  { id: 10, name: 'Masala Chai', category: 'Beverage', price: 60 },
];

function App() {
  const [menu, setMenu] = useState([]);
  const [search, setSearch] = useState('');
  const [orderItems, setOrderItems] = useState([]);
  const [tableNo, setTableNo] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [customer, setCustomer] = useState('');
  const [type, setType] = useState('Dine-In');
  const [discount, setDiscount] = useState(0);
  const [showEdit, setShowEdit] = useState(false);
  const [editItem, setEditItem] = useState(null);

  // load menu from localStorage or defaults
  useEffect(() => {
    const stored = localStorage.getItem('menu');
    if (stored) {
      setMenu(JSON.parse(stored));
    } else {
      setMenu(defaultMenu);
    }
  }, []);

  // persist menu changes
  useEffect(() => {
    localStorage.setItem('menu', JSON.stringify(menu));
  }, [menu]);

  const filteredMenu = menu.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const addToOrder = (item) => {
    setOrderItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { ...item, qty: 1, notes: '' }];
    });
  };

  const updateOrderItem = (id, changes) => {
    setOrderItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...changes } : i))
    );
  };

  const removeOrderItem = (id) => {
    setOrderItems((prev) => prev.filter((i) => i.id !== id));
  };

  const subtotal = orderItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const cgst = subtotal * 0.025;
  const sgst = subtotal * 0.025;
  const total = subtotal + cgst + sgst - discount;

  const newBill = () => {
    setOrderItems([]);
    setTableNo('');
    setOrderNo('');
    setCustomer('');
    setDiscount(0);
    setType('Dine-In');
  };

  const generateBill = () => {
    // simple alert for now
    alert('Bill Generated!');
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.text('Restaurant Bill', 10, 10);
    doc.text(`Table: ${tableNo || '-'}   Order: ${orderNo || '-'}   Customer: ${customer || '-'}`, 10, 20);
    let y = 30;
    orderItems.forEach((i) => {
      doc.text(`${i.name} x${i.qty} - ₹${i.price * i.qty}`, 10, y);
      y += 10;
    });
    doc.text(`Subtotal: ₹${subtotal.toFixed(2)}`, 10, y + 10);
    doc.text(`CGST (2.5%): ₹${cgst.toFixed(2)}`, 10, y + 20);
    doc.text(`SGST (2.5%): ₹${sgst.toFixed(2)}`, 10, y + 30);
    doc.text(`Discount: -₹${discount.toFixed(2)}`, 10, y + 40);
    doc.text(`Grand Total: ₹${total.toFixed(2)}`, 10, y + 50);
    doc.save('bill.pdf');
  };

  const openEditModal = (item = null) => {
    setEditItem(item);
    setShowEdit(true);
  };

  const saveMenuItem = (e) => {
    e.preventDefault();
    const form = e.target;
    const id = editItem ? editItem.id : Date.now();
    const name = form.name.value.trim();
    const category = form.category.value.trim();
    const price = parseFloat(form.price.value);
    const newItem = { id, name, category, price };
    setMenu((prev) => {
      if (editItem) {
        return prev.map((i) => (i.id === id ? newItem : i));
      }
      return [...prev, newItem];
    });
    setShowEdit(false);
  };

  const deleteMenuItem = (id) => {
    if (window.confirm('Delete this menu item?')) {
      setMenu((prev) => prev.filter((i) => i.id !== id));
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="logo">🍽️</div>
        <div className="title">
          <h1>Spice Villa</h1>
          <p>Authentic Indian Cuisine</p>
        </div>
        <button className="edit-btn" onClick={() => openEditModal()}>
          Edit Menu
        </button>
      </header>

      <main className="main">
        <section className="menu-section">
          <h2>Menu</h2>
          <input
            type="text"
            placeholder="Search dishes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search"
          />
          <div className="menu-list">
            {filteredMenu.map((item) => (
              <div key={item.id} className="menu-card">
                <div className="info">
                  <strong>{item.name}</strong>
                  <span className="category">{item.category}</span>
                </div>
                <div className="price">₹{item.price}</div>
                <div className="actions">
                  <button onClick={() => addToOrder(item)}>Add</button>
                  <button className="edit" onClick={() => openEditModal(item)}>
                    ✏️
                  </button>
                  <button className="delete" onClick={() => deleteMenuItem(item.id)}>
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="order-section">
          <h2>Current Order</h2>
          <div className="order-controls">
            <input
              type="text"
              placeholder="Table / Order No"
              value={tableNo}
              onChange={(e) => setTableNo(e.target.value)}
            />
            <input
              type="text"
              placeholder="Customer Name"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            />
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option>Dine-In</option>
              <option>Takeaway</option>
            </select>
            <input
              type="number"
              placeholder="Discount ₹"
              value={discount}
              min="0"
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
            />
          </div>
          <table className="order-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Notes</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orderItems.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td>
                    <input
                      type="text"
                      value={i.notes}
                      placeholder="Add notes"
                      onChange={(e) =>
                        updateOrderItem(i.id, { notes: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <button
                      onClick={() =>
                        updateOrderItem(i.id, { qty: Math.max(1, i.qty - 1) })
                      }
                    >-</button>
                    <span>{i.qty}</span>
                    <button onClick={() => updateOrderItem(i.id, { qty: i.qty + 1 })}>+</button>
                  </td>
                  <td>₹{i.price}</td>
                  <td>₹{(i.price * i.qty).toFixed(2)}</td>
                  <td>
                    <button onClick={() => removeOrderItem(i.id)} className="delete">
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="summary">
            <p>Subtotal: ₹{subtotal.toFixed(2)}</p>
            <p>CGST (2.5%): ₹{cgst.toFixed(2)}</p>
            <p>SGST (2.5%): ₹{sgst.toFixed(2)}</p>
            <p>Discount: -₹{discount.toFixed(2)}</p>
            <h3>Grand Total: ₹{total.toFixed(2)}</h3>
          </div>
          <div className="action-buttons">
            <button onClick={newBill}>New Bill</button>
            <button onClick={generateBill}>Generate Bill</button>
            <button onClick={() => window.print()}>Print</button>
            <button onClick={downloadPDF}>Download PDF</button>
          </div>
        </section>
      </main>

      {showEdit && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editItem ? 'Edit' : 'Add'} Menu Item</h2>
            <form onSubmit={saveMenuItem} className="modal-form">
              <label>
                Name:
                <input name="name" defaultValue={editItem?.name || ''} required />
              </label>
              <label>
                Category:
                <input name="category" defaultValue={editItem?.category || ''} required />
              </label>
              <label>
                Price (₹):
                <input
                  name="price"
                  type="number"
                  step="0.01"
                  defaultValue={editItem?.price || ''}
                  required
                />
              </label>
              <div className="modal-actions">
                <button type="submit">Save</button>
                <button type="button" onClick={() => setShowEdit(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
