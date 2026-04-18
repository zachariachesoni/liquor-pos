import React, { useState, useEffect } from 'react';
import { Mail, Shield, UserCog, Send, Trash2, X } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import './Products.css';

const Employees = () => {
  const { isAdmin } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [inviteFeedback, setInviteFeedback] = useState(null);
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    role: 'cashier'
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      // Filter out admins if we just want to see employees, or show all
      setEmployees(res.data.data.filter(u => u.role !== 'admin'));
    } catch (err) {
      console.error('Failed to load employees', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    try {
      const payload = {
         ...formData
      };
      const res = await api.post('/users', payload);
      const emailSent = res.data.emailSent;
      
      setInviteFeedback({
        status: 'success',
        message: emailSent ? 'Employee account created and invite sent.' : 'Employee account created, but the email invite was not sent.',
        emailResponse: res.data.emailResponse,
        emailSent,
        details: `Username: ${formData.username}\nTemp Password: ${res.data.temporaryPassword}`
      });
      
      setShowModal(false);
      fetchEmployees();
      setFormData({ username: '', email: '', role: 'cashier' });
    } catch (err) {
      setInviteFeedback({
        status: 'error',
        message: err.response?.data?.message || 'Error creating employee account'
      });
      console.error(err);
    }
  };

  const handleDeleteEmployee = async (employeeId, username) => {
    if (!window.confirm(`Delete employee account for ${username}?`)) return;

    try {
      await api.delete(`/users/${employeeId}`);
      setInviteFeedback({
        status: 'success',
        message: `Employee account for ${username} deleted.`,
        emailResponse: 'Account removed successfully.',
        emailSent: true,
      });
      fetchEmployees();
    } catch (err) {
      setInviteFeedback({
        status: 'error',
        message: err.response?.data?.message || 'Error deleting employee account'
      });
      console.error(err);
    }
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div className="page-header-copy">
          <h1 className="page-title">Employee Management</h1>
          <p className="page-subtitle">Provision staff accounts and send secure invites.</p>
        </div>
        <div className="page-header-actions">
          <button className="primary-btn" onClick={() => setShowModal(true)}>
             <UserCog size={18} /> Add Employee
          </button>
        </div>
      </div>

      {inviteFeedback && (
        <div className={`feedback-card ${inviteFeedback.status}`}>
          <h3 className="feedback-card-title">{inviteFeedback.message}</h3>
          {inviteFeedback.status === 'success' && (
             <>
               <p className="feedback-card-copy"><strong>Email Status:</strong> {inviteFeedback.emailResponse}</p>
               {!inviteFeedback.emailSent && (
                 <>
                   <p className="feedback-card-copy">
                     The employee can still log in right away using these temporary credentials:
                   </p>
                   <div className="feedback-code">
                     {inviteFeedback.details}
                   </div>
                 </>
               )}
             </>
          )}
          <button className="action-icon feedback-dismiss" onClick={() => setInviteFeedback(null)}>Dismiss</button>
        </div>
      )}

      <div className="glass-panel main-panel">
        <div className="table-container">
          {loading ? (
             <div className="inline-loading">Loading employees from database...</div>
          ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                {isAdmin && <th className="text-center">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp._id}>
                  <td className="font-medium text-primary">
                    <div className="inline-cluster">
                      <Shield size={16} /> {emp.username}
                    </div>
                  </td>
                  <td>
                    <div className="inline-cluster">
                      <Mail size={14} className="text-secondary" /> {emp.email}
                    </div>
                  </td>
                  <td><span className="badge">{emp.role}</span></td>
                  <td>
                    {emp.is_active ? <span className="status-dot green" title="Active"></span> : <span className="status-dot red" title="Inactive"></span>}
                    {emp.is_active ? 'Active' : 'Disabled'}
                  </td>
                  {isAdmin && (
                    <td className="action-cell">
                      <button className="action-icon text-danger" title="Delete employee" onClick={() => handleDeleteEmployee(emp._id, emp.username)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? '5' : '4'} className="empty-state">No employee records found.</td>
                </tr>
              )}
            </tbody>
          </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-card">
            <button className="modal-close-btn" onClick={() => setShowModal(false)}>
              <X size={20} />
            </button>
            <h2 className="modal-title">Invite New Employee</h2>
            <form onSubmit={handleCreateEmployee} className="modal-form">
              <div className="modal-form-grid">
                <div className="modal-form-field">
                  <label>Username</label>
                  <input required type="text" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
                </div>
                <div className="modal-form-field">
                  <label>Email Address</label>
                  <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="modal-form-field modal-form-field-full">
                  <label>Role</label>
                  <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                     <option value="manager">Manager</option>
                     <option value="cashier">Cashier</option>
                  </select>
                </div>
              </div>
              <p className="modal-note">A secure temporary password will be generated automatically when the account is created.</p>
              <div className="modal-actions">
                <button type="submit" className="primary-btn"><Send size={18} /> Provision & Dispatch Invite</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;
