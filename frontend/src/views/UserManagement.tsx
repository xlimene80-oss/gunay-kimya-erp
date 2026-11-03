import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  Building2,
  Globe,
  KeyRound,
  Check,
  Sliders,
  ShieldCheck,
  Edit2,
  Trash2,
  Shield,
  Info,
  Copy,
  Lock,
  Unlock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface DepartmentRecord {
  id: number;
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
  user_count: number;
  permissions?: Record<string, Record<string, boolean>>;
  created_at: string;
}

interface UserRecord {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'staff' | 'customer';
  is_active: boolean;
  user_code?: string | null;
  is_locked?: boolean;
  department_id?: number | null;
  department_name?: string | null;
  department_code?: string | null;
  cari_id?: number | null;
  cari_title?: string | null;
  cari_code?: string | null;
  roles: string[];
  created_at: string;
  permissions?: Record<string, any>;
  effective_permissions?: Record<string, Record<string, boolean>>;
}

interface CariOption {
  id: number;
  code: string;
  title: string;
  tax_number?: string;
  phone?: string;
}

interface ModuleMeta {
  id: string;
  name: string;
  category: string;
}

interface ActionMeta {
  id: 'read' | 'create' | 'update' | 'delete' | 'approve';
  name: string;
}

interface UserManagementProps {
  currentView?: string;
  onNavigate?: (view: string) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ currentView, onNavigate }) => {
  const { can } = useAuth();
  const canCreateUser = can('settings_users', 'create');
  const canDeleteUser = can('settings_users', 'delete');
  const canUpdatePerms = can('settings_permissions', 'update');
  const canCreateDept = can('settings_permissions', 'create');
  const canDeleteDept = can('settings_permissions', 'delete');

  // Determine active tab based on sidebar navigation
  const getInitialTab = (): 'users' | 'departments' | 'permissions' | 'system' => {
    if (currentView === 'settings_permissions') return 'permissions';
    if (currentView === 'settings_system') return 'system';
    return 'users';
  };

  const [activeTab, setActiveTab] = useState<'users' | 'departments' | 'permissions' | 'system'>(getInitialTab);

  // Sync tab if currentView prop changes
  useEffect(() => {
    if (currentView === 'settings_permissions') {
      setActiveTab('permissions');
    } else if (currentView === 'settings_system') {
      setActiveTab('system');
    } else if (currentView === 'settings_users' || currentView === 'user_management') {
      setActiveTab('users');
    }
  }, [currentView]);

  // Data states
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [caris, setCaris] = useState<CariOption[]>([]);
  const [modules, setModules] = useState<ModuleMeta[]>([]);
  const [actionsList, setActionsList] = useState<ActionMeta[]>([
    { id: 'read', name: 'Görüntüle' },
    { id: 'create', name: 'Ekle' },
    { id: 'update', name: 'Düzenle' },
    { id: 'delete', name: 'Sil' },
    { id: 'approve', name: 'Onayla' }
  ]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters for User Tab
  const [userSearch, setUserSearch] = useState<string>('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('ALL');
  const [userDeptFilter, setUserDeptFilter] = useState<string>('ALL');

  // Modal State - User Create / Edit
  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userModalMode, setUserModalMode] = useState<'STAFF' | 'CUSTOMER'>('STAFF');
  const [formSaving, setFormSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Form Fields - User
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userPassword, setUserPassword] = useState<string>('');
  const [userDeptId, setUserDeptId] = useState<number | ''>('');
  const [userSystemRole, setUserSystemRole] = useState<'admin' | 'staff' | 'customer'>('staff');
  const [userIsActive, setUserIsActive] = useState<boolean>(true);
  const [selectedCariId, setSelectedCariId] = useState<number | ''>('');

  // Password Reset Modal
  const [isResetPwdModalOpen, setIsResetPwdModalOpen] = useState<boolean>(false);
  const [resetTargetUser, setResetTargetUser] = useState<UserRecord | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState<string>('');
  const [resetSaving, setResetSaving] = useState<boolean>(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // Department Modal
  const [isDeptModalOpen, setIsDeptModalOpen] = useState<boolean>(false);
  const [editingDeptId, setEditingDeptId] = useState<number | null>(null);
  const [deptName, setDeptName] = useState<string>('');
  const [deptCode, setDeptCode] = useState<string>('');
  const [deptDescription, setDeptDescription] = useState<string>('');
  const [deptIsActive, setDeptIsActive] = useState<boolean>(true);
  const [deptSaving, setDeptSaving] = useState<boolean>(false);
  const [deptError, setDeptError] = useState<string | null>(null);
  const [deptSuccess, setDeptSuccess] = useState<string | null>(null);

  // Permissions Matrix Tab State
  const [matrixTargetType, setMatrixTargetType] = useState<'DEPARTMENT' | 'USER'>('DEPARTMENT');
  const [selectedDeptIdForMatrix, setSelectedDeptIdForMatrix] = useState<number | ''>('');
  const [selectedUserIdForMatrix, setSelectedUserIdForMatrix] = useState<number | ''>('');
  const [matrixData, setMatrixData] = useState<Record<string, Record<string, boolean>>>({});
  const [matrixSaving, setMatrixSaving] = useState<boolean>(false);
  const [matrixSuccess, setMatrixSuccess] = useState<string | null>(null);
  const [matrixError, setMatrixError] = useState<string | null>(null);

  // Load Initial Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, deptsRes, carisRes, metaRes] = await Promise.all([
        axios.get('/api/v1/auth/users'),
        axios.get('/api/v1/auth/departments'),
        axios.get('/api/v1/caris/?cari_type=CUSTOMER&limit=300').catch(() => ({ data: [] })),
        axios.get('/api/v1/auth/permissions/modules').catch(() => ({
          data: { modules: [], actions: [] }
        }))
      ]);

      setUsers(usersRes.data || []);
      setDepartments(deptsRes.data || []);
      setCaris(carisRes.data?.items || carisRes.data || []);

      if (metaRes.data?.modules && metaRes.data.modules.length > 0) {
        setModules(metaRes.data.modules);
      }
      if (metaRes.data?.actions && metaRes.data.actions.length > 0) {
        setActionsList(metaRes.data.actions);
      }

      // Default selection for permissions matrix
      if (deptsRes.data && deptsRes.data.length > 0 && selectedDeptIdForMatrix === '') {
        setSelectedDeptIdForMatrix(deptsRes.data[0].id);
      }
      if (usersRes.data && usersRes.data.length > 0 && selectedUserIdForMatrix === '') {
        setSelectedUserIdForMatrix(usersRes.data[0].id);
      }
    } catch (err: any) {
      console.error('Veri yüklenirken hata oluştu:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update matrix data whenever target changes
  useEffect(() => {
    if (matrixTargetType === 'DEPARTMENT' && selectedDeptIdForMatrix !== '') {
      const targetDept = departments.find((d) => d.id === Number(selectedDeptIdForMatrix));
      if (targetDept && targetDept.permissions) {
        setMatrixData(JSON.parse(JSON.stringify(targetDept.permissions)));
      } else {
        setMatrixData({});
      }
    } else if (matrixTargetType === 'USER' && selectedUserIdForMatrix !== '') {
      const targetUser = users.find((u) => u.id === Number(selectedUserIdForMatrix));
      if (targetUser) {
        const base = targetUser.effective_permissions || {};
        setMatrixData(JSON.parse(JSON.stringify(base)));
      }
    }
  }, [matrixTargetType, selectedDeptIdForMatrix, selectedUserIdForMatrix, departments, users]);

  // ==========================================
  // USER HANDLERS
  // ==========================================
  const openCreateUserModal = () => {
    setEditingUserId(null);
    setUserName('');
    setUserEmail('');
    setUserPassword('');
    setUserDeptId(departments.length > 0 ? departments[0].id : '');
    setUserSystemRole('staff');
    setUserIsActive(true);
    setSelectedCariId('');
    setUserModalMode('STAFF');
    setFormError(null);
    setFormSuccess(null);
    setIsUserModalOpen(true);
  };

  const openEditUserModal = (u: UserRecord) => {
    setEditingUserId(u.id);
    setUserName(u.full_name);
    setUserEmail(u.email);
    setUserPassword(''); // Keep blank unless resetting
    setUserDeptId(u.department_id || '');
    setUserSystemRole(u.role);
    setUserIsActive(u.is_active);
    setSelectedCariId(u.cari_id || '');
    setUserModalMode(u.role === 'customer' ? 'CUSTOMER' : 'STAFF');
    setFormError(null);
    setFormSuccess(null);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!userName.trim() || !userEmail.trim()) {
      setFormError('Lütfen ad soyad ve e-posta alanlarını doldurunuz.');
      return;
    }

    if (!editingUserId && (!userPassword.trim() || userPassword.length < 6)) {
      setFormError('Yeni kullanıcılar için en az 6 karakterli şifre zorunludur.');
      return;
    }

    if (userModalMode === 'CUSTOMER' && !selectedCariId) {
      setFormError('B2B Müşteri için bir Cari Hesap seçimi zorunludur.');
      return;
    }

    setFormSaving(true);
    try {
      if (editingUserId) {
        // Edit User
        const updatePayload: any = {
          full_name: userName.trim(),
          email: userEmail.trim().toLowerCase(),
          role: userModalMode === 'CUSTOMER' ? 'customer' : userSystemRole,
          department_id: userModalMode === 'CUSTOMER' ? null : (userDeptId ? Number(userDeptId) : null),
          is_active: userIsActive,
          cari_id: userModalMode === 'CUSTOMER' ? Number(selectedCariId) : null
        };
        if (userPassword.trim()) {
          updatePayload.password = userPassword.trim();
        }

        const res = await axios.put(`/api/v1/auth/users/${editingUserId}`, updatePayload);
        setUsers((prev) => prev.map((u) => (u.id === editingUserId ? res.data : u)));
        setFormSuccess('Kullanıcı bilgileri başarıyla güncellendi.');
      } else {
        // Create User
        const createPayload = {
          full_name: userName.trim(),
          email: userEmail.trim().toLowerCase(),
          password: userPassword.trim(),
          role: userModalMode === 'CUSTOMER' ? 'customer' : userSystemRole,
          department_id: userModalMode === 'CUSTOMER' ? null : (userDeptId ? Number(userDeptId) : null),
          cari_id: userModalMode === 'CUSTOMER' ? Number(selectedCariId) : null,
          is_active: userIsActive
        };

        const res = await axios.post('/api/v1/auth/users', createPayload);
        setUsers((prev) => [res.data, ...prev]);
        if (res.data?.user_code) {
          setFormSuccess(`Yeni B2B kullanıcısı oluşturuldu! Kullanıcı Kodu: ${res.data.user_code}`);
        } else {
          setFormSuccess('Yeni kullanıcı başarıyla oluşturuldu.');
        }
      }

      setTimeout(() => {
        setIsUserModalOpen(false);
      }, 1200);
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Kullanıcı kaydedilirken hata oluştu.');
    } finally {
      setFormSaving(false);
    }
  };

  const handleUnlockUser = async (u: UserRecord) => {
    try {
      const res = await axios.post(`/api/v1/auth/users/${u.id}/unlock`);
      setUsers((prev) => prev.map((item) => (item.id === u.id ? res.data : item)));
      alert(`'${u.full_name}' (${u.email}) kullanıcısının hesap kilidi başarıyla açıldı.`);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Hesap kilidi açılamadı.');
    }
  };

  const handleToggleUserStatus = async (u: UserRecord) => {
    try {
      const res = await axios.patch(`/api/v1/auth/users/${u.id}/status?is_active=${!u.is_active}`);
      setUsers((prev) => prev.map((item) => (item.id === u.id ? { ...item, is_active: res.data.is_active } : item)));
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Durum değiştirilemedi.');
    }
  };

  const handleOpenResetPassword = (u: UserRecord) => {
    setResetTargetUser(u);
    setNewPasswordVal('');
    setResetError(null);
    setResetSuccess(null);
    setIsResetPwdModalOpen(true);
  };

  const handleSaveResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;
    if (newPasswordVal.length < 6) {
      setResetError('Şifre en az 6 karakter olmalıdır.');
      return;
    }

    setResetSaving(true);
    setResetError(null);
    try {
      await axios.post(`/api/v1/auth/users/${resetTargetUser.id}/reset-password`, {
        new_password: newPasswordVal
      });
      setResetSuccess('Şifre başarıyla güncellendi.');
      setTimeout(() => {
        setIsResetPwdModalOpen(false);
      }, 700);
    } catch (err: any) {
      setResetError(err.response?.data?.detail || 'Şifre sıfırlanırken hata oluştu.');
    } finally {
      setResetSaving(false);
    }
  };

  const handleDeleteUser = async (u: UserRecord) => {
    if (!window.confirm(`'${u.full_name}' (${u.email}) kullanıcısını silmek istediğinize emin misiniz?`)) {
      return;
    }
    try {
      await axios.delete(`/api/v1/auth/users/${u.id}`);
      setUsers((prev) => prev.filter((item) => item.id !== u.id));
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Kullanıcı silinemedi.');
    }
  };

  // ==========================================
  // DEPARTMENT HANDLERS
  // ==========================================
  const openCreateDeptModal = () => {
    setEditingDeptId(null);
    setDeptName('');
    setDeptCode('');
    setDeptDescription('');
    setDeptIsActive(true);
    setDeptError(null);
    setDeptSuccess(null);
    setIsDeptModalOpen(true);
  };

  const openEditDeptModal = (d: DepartmentRecord) => {
    setEditingDeptId(d.id);
    setDeptName(d.name);
    setDeptCode(d.code);
    setDeptDescription(d.description || '');
    setDeptIsActive(d.is_active);
    setDeptError(null);
    setDeptSuccess(null);
    setIsDeptModalOpen(true);
  };

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim() || !deptCode.trim()) {
      setDeptError('Lütfen departman adı ve kodunu eksiksiz giriniz.');
      return;
    }

    setDeptSaving(true);
    setDeptError(null);
    setDeptSuccess(null);

    try {
      if (editingDeptId) {
        const res = await axios.put(`/api/v1/auth/departments/${editingDeptId}`, {
          name: deptName.trim(),
          code: deptCode.trim().toUpperCase(),
          description: deptDescription.trim(),
          is_active: deptIsActive
        });
        setDepartments((prev) => prev.map((d) => (d.id === editingDeptId ? res.data : d)));
        setDeptSuccess('Departman başarıyla güncellendi.');
      } else {
        const res = await axios.post('/api/v1/auth/departments', {
          name: deptName.trim(),
          code: deptCode.trim().toUpperCase(),
          description: deptDescription.trim(),
          is_active: deptIsActive
        });
        setDepartments((prev) => [...prev, res.data]);
        setDeptSuccess('Yeni departman başarıyla oluşturuldu.');
      }

      setTimeout(() => {
        setIsDeptModalOpen(false);
      }, 700);
    } catch (err: any) {
      setDeptError(err.response?.data?.detail || 'Departman kaydedilirken hata oluştu.');
    } finally {
      setDeptSaving(false);
    }
  };

  const handleDeleteDept = async (d: DepartmentRecord) => {
    if (d.user_count > 0) {
      if (!window.confirm(`Bu departmana bağlı ${d.user_count} kullanıcı bulunmaktadır. Departman silindiğinde bu kullanıcıların departman bağı kaldırılacaktır. Onaylıyor musunuz?`)) {
        return;
      }
    } else {
      if (!window.confirm(`'${d.name}' departmanını silmek istediğinize emin misiniz?`)) {
        return;
      }
    }

    try {
      await axios.delete(`/api/v1/auth/departments/${d.id}`);
      setDepartments((prev) => prev.filter((item) => item.id !== d.id));
      // Refresh users to reflect unlinked departments
      const res = await axios.get('/api/v1/auth/users');
      setUsers(res.data);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Departman silinemedi.');
    }
  };

  // ==========================================
  // PERMISSIONS MATRIX HANDLERS
  // ==========================================
  const togglePermissionCell = (moduleId: string, actionId: string) => {
    setMatrixData((prev) => {
      const currentMod = prev[moduleId] || {
        read: false,
        create: false,
        update: false,
        delete: false,
        approve: false
      };
      return {
        ...prev,
        [moduleId]: {
          ...currentMod,
          [actionId]: !currentMod[actionId]
        }
      };
    });
  };

  const toggleAllActionsForModule = (moduleId: string) => {
    setMatrixData((prev) => {
      const currentMod = prev[moduleId] || {};
      const allActive = actionsList.every((act) => currentMod[act.id]);
      const nextState = !allActive;
      const updatedMod: Record<string, boolean> = {};
      actionsList.forEach((act) => {
        updatedMod[act.id] = nextState;
      });
      return {
        ...prev,
        [moduleId]: updatedMod
      };
    });
  };

  const toggleAllForActionColumn = (actionId: string) => {
    setMatrixData((prev) => {
      const allActive = modules.every((m) => prev[m.id]?.[actionId]);
      const nextState = !allActive;
      const updated = { ...prev };
      modules.forEach((m) => {
        if (!updated[m.id]) {
          updated[m.id] = { read: false, create: false, update: false, delete: false, approve: false };
        }
        updated[m.id][actionId] = nextState;
      });
      return updated;
    });
  };

  const handleSaveMatrix = async () => {
    setMatrixSaving(true);
    setMatrixError(null);
    setMatrixSuccess(null);

    try {
      if (matrixTargetType === 'DEPARTMENT') {
        if (!selectedDeptIdForMatrix) return;
        const res = await axios.put(`/api/v1/auth/departments/${selectedDeptIdForMatrix}`, {
          permissions: matrixData
        });
        setDepartments((prev) =>
          prev.map((d) => (d.id === Number(selectedDeptIdForMatrix) ? res.data : d))
        );
        // Refresh users to recalculate effective permissions
        const usersRes = await axios.get('/api/v1/auth/users');
        setUsers(usersRes.data);
        setMatrixSuccess('Departman yetki matrisi başarıyla veritabanına kaydedildi.');
      } else {
        if (!selectedUserIdForMatrix) return;
        const res = await axios.patch(`/api/v1/auth/users/${selectedUserIdForMatrix}/permissions`, {
          permissions: matrixData
        });
        setUsers((prev) =>
          prev.map((u) => (u.id === Number(selectedUserIdForMatrix) ? res.data : u))
        );
        setMatrixSuccess('Kullanıcıya özel yetki matrisi (override) başarıyla veritabanına kaydedildi.');
      }

      setTimeout(() => {
        setMatrixSuccess(null);
      }, 2500);
    } catch (err: any) {
      setMatrixError(err.response?.data?.detail || 'Yetki matrisi kaydedilirken hata oluştu.');
    } finally {
      setMatrixSaving(false);
    }
  };

  // Filtered Users List
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.department_name && u.department_name.toLowerCase().includes(userSearch.toLowerCase())) ||
      (u.cari_title && u.cari_title.toLowerCase().includes(userSearch.toLowerCase()));

    const matchesRole =
      userRoleFilter === 'ALL' ||
      (userRoleFilter === 'ADMIN' && u.role === 'admin') ||
      (userRoleFilter === 'STAFF' && u.role === 'staff') ||
      (userRoleFilter === 'CUSTOMER' && u.role === 'customer');

    const matchesStatus =
      userStatusFilter === 'ALL' ||
      (userStatusFilter === 'ACTIVE' && u.is_active) ||
      (userStatusFilter === 'PASSIVE' && !u.is_active);

    const matchesDept =
      userDeptFilter === 'ALL' ||
      (userDeptFilter === 'NONE' && !u.department_id) ||
      u.department_id === Number(userDeptFilter);

    return matchesSearch && matchesRole && matchesStatus && matchesDept;
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Header Card */}
      <div className="bg-surface rounded-2xl border border-border p-5 md:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-soft text-primary text-xs font-bold mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span>Merkezi Erişim & Yetki Denetimi</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-text tracking-tight">
            Kullanıcı, Departman ve Yetki Yönetimi
          </h1>
          <p className="text-xs text-text-muted mt-1 max-w-2xl">
            Sistem kullanıcılarını tanımlayın, departman bazlı veya kişiye özel 5 boyutlu (Görüntüle, Ekle, Düzenle, Sil, Onayla) yetki matrisini yönetin.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="self-start md:self-auto p-2.5 rounded-xl border border-border text-text-muted hover:text-text hover:bg-bg transition shadow-sm"
          title="Verileri Yenile"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-border gap-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => {
            setActiveTab('users');
            onNavigate?.('settings_users');
          }}
          className={`flex items-center gap-2 py-3 px-5 text-xs font-bold transition border-b-2 whitespace-nowrap ${
            activeTab === 'users'
              ? 'border-primary text-primary bg-primary-soft/30 rounded-t-xl'
              : 'border-transparent text-text-muted hover:text-text hover:bg-bg/50 rounded-t-xl'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Kullanıcı Yönetimi</span>
          <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-bg font-mono border border-border">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('departments');
          }}
          className={`flex items-center gap-2 py-3 px-5 text-xs font-bold transition border-b-2 whitespace-nowrap ${
            activeTab === 'departments'
              ? 'border-primary text-primary bg-primary-soft/30 rounded-t-xl'
              : 'border-transparent text-text-muted hover:text-text hover:bg-bg/50 rounded-t-xl'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Departman Yönetimi</span>
          <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-bg font-mono border border-border">
            {departments.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('permissions');
            onNavigate?.('settings_permissions');
          }}
          className={`flex items-center gap-2 py-3 px-5 text-xs font-bold transition border-b-2 whitespace-nowrap ${
            activeTab === 'permissions'
              ? 'border-primary text-primary bg-primary-soft/30 rounded-t-xl'
              : 'border-transparent text-text-muted hover:text-text hover:bg-bg/50 rounded-t-xl'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Yetki Matrisi (ACL)</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('system');
            onNavigate?.('settings_system');
          }}
          className={`flex items-center gap-2 py-3 px-5 text-xs font-bold transition border-b-2 whitespace-nowrap ${
            activeTab === 'system'
              ? 'border-primary text-primary bg-primary-soft/30 rounded-t-xl'
              : 'border-transparent text-text-muted hover:text-text hover:bg-bg/50 rounded-t-xl'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Sistem & Güvenlik</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: KULLANICILAR */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Action Bar & Filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-surface p-4 rounded-xl border border-border">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[200px] flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Kullanıcı ara (isim, e-posta, cari)..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-bg border border-border rounded-lg text-text focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <select
                value={userDeptFilter}
                onChange={(e) => setUserDeptFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-bg border border-border rounded-lg text-text font-medium"
              >
                <option value="ALL">Tüm Departmanlar</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
                <option value="NONE">Departmansız</option>
              </select>

              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-bg border border-border rounded-lg text-text font-medium"
              >
                <option value="ALL">Tüm Roller</option>
                <option value="ADMIN">Yöneticiler (Admin)</option>
                <option value="STAFF">Personeller (Staff)</option>
                <option value="CUSTOMER">B2B Müşterileri</option>
              </select>

              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-bg border border-border rounded-lg text-text font-medium"
              >
                <option value="ALL">Tüm Durumlar</option>
                <option value="ACTIVE">Yalnızca Aktif</option>
                <option value="PASSIVE">Yalnızca Pasif</option>
              </select>
            </div>

            {canCreateUser && (
              <button
                onClick={openCreateUserModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-sm hover:bg-[#241a63] transition active:scale-95 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Yeni Kullanıcı Ekle</span>
              </button>
            )}
          </div>

          {/* Users Table */}
          <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-bg/80 border-b border-border text-text-muted font-bold uppercase text-[10px]">
                    <th className="py-3 px-4">Kullanıcı Bilgileri</th>
                    <th className="py-3 px-4">Departman / Rol</th>
                    <th className="py-3 px-4">Cari Hesap (B2B)</th>
                    <th className="py-3 px-4 text-center">Durum</th>
                    <th className="py-3 px-4 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-text-muted">
                        Kriterlere uygun kullanıcı bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-bg/40 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-text">{u.full_name}</div>
                          <div className="text-[11px] text-text-muted font-mono">{u.email}</div>
                          {u.user_code && (
                            <div className="inline-flex items-center gap-1.5 mt-1">
                              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-[10px] border border-emerald-500/20">
                                {u.user_code}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(u.user_code || '');
                                  alert(`Kullanıcı kodu kopyalandı: ${u.user_code}`);
                                }}
                                className="p-0.5 text-text-muted hover:text-text hover:bg-bg rounded transition"
                                title="Kodu Kopyala"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {u.department_name ? (
                              <span className="px-2 py-0.5 rounded-md bg-primary-soft text-primary font-bold text-[10px]">
                                {u.department_name}
                              </span>
                            ) : (
                              <span className="text-text-muted text-[10px]">—</span>
                            )}
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                                u.role === 'admin'
                                  ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                  : u.role === 'customer'
                                  ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                                  : 'bg-bg text-text-muted border border-border'
                              }`}
                            >
                              {u.role}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {u.cari_title ? (
                            <div>
                              <div className="font-bold text-text truncate max-w-[180px]">{u.cari_title}</div>
                              <div className="text-[10px] font-mono text-text-muted">{u.cari_code}</div>
                            </div>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <button
                              onClick={() => handleToggleUserStatus(u)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition ${
                                u.is_active
                                  ? 'bg-success/10 text-success hover:bg-success/20'
                                  : 'bg-danger/10 text-danger hover:bg-danger/20'
                              }`}
                              title="Tıklayarak durumu değiştirin"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-success' : 'bg-danger'}`} />
                              <span>{u.is_active ? 'Aktif' : 'Pasif'}</span>
                            </button>
                            {u.is_locked && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[9px] font-bold animate-pulse">
                                <Lock className="w-2.5 h-2.5" />
                                Kilitli (15 dk)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {u.is_locked && (
                              <button
                                onClick={() => handleUnlockUser(u)}
                                className="p-1.5 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-100/50 transition"
                                title="Hesap Kilidini Aç"
                              >
                                <Unlock className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setMatrixTargetType('USER');
                                setSelectedUserIdForMatrix(u.id);
                                setActiveTab('permissions');
                              }}
                              className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-soft transition"
                              title="Yetki Matrisini Düzenle"
                            >
                              <Sliders className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenResetPassword(u)}
                              className="p-1.5 rounded-lg text-text-muted hover:text-amber-600 hover:bg-amber-50 transition"
                              title="Şifre Sıfırla"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditUserModal(u)}
                              className="p-1.5 rounded-lg text-text-muted hover:text-blue-600 hover:bg-blue-50 transition"
                              title="Kullanıcıyı Düzenle"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {canDeleteUser && (
                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition"
                                title="Kullanıcıyı Sil"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DEPARTMANLAR */}
      {/* ========================================================================= */}
      {activeTab === 'departments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-surface p-4 rounded-xl border border-border">
            <div>
              <h2 className="text-sm font-bold text-text">Şirket Departman Listesi</h2>
              <p className="text-xs text-text-muted">
                Her departman için varsayılan yetki şablonu belirleyebilir, yeni departmanlar oluşturabilirsiniz.
              </p>
            </div>
            {canCreateDept && (
              <button
                onClick={openCreateDeptModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-sm hover:bg-[#241a63] transition"
              >
                <Plus className="w-4 h-4" />
                <span>Yeni Departman Ekle</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {departments.map((d) => (
              <div
                key={d.id}
                className="bg-surface p-5 rounded-2xl border border-border shadow-sm flex flex-col justify-between hover:shadow-md transition"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center font-bold font-mono">
                      {d.code.slice(0, 3)}
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-bg text-text-muted border border-border">
                      {d.code}
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-text mt-3">{d.name}</h3>
                  <p className="text-xs text-text-muted mt-1 line-clamp-2 min-h-[32px]">
                    {d.description || 'Departman açıklaması girilmemiş.'}
                  </p>

                  <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs">
                    <span className="text-text-muted font-medium">Bağlı Personel</span>
                    <span className="font-bold text-primary font-mono">{d.user_count} Kişi</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setMatrixTargetType('DEPARTMENT');
                      setSelectedDeptIdForMatrix(d.id);
                      setActiveTab('permissions');
                    }}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-bg hover:bg-primary-soft hover:text-primary text-[11px] font-bold text-text-muted transition flex items-center justify-center gap-1 border border-border"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Yetki Şablonu</span>
                  </button>

                  <button
                    onClick={() => openEditDeptModal(d)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-blue-600 hover:bg-bg transition border border-border"
                    title="Düzenle"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {canDeleteDept && (
                    <button
                      onClick={() => handleDeleteDept(d)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-bg transition border border-border"
                      title="Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: YETKİ MATRİSİ (ACL) */}
      {/* ========================================================================= */}
      {activeTab === 'permissions' && (
        <div className="space-y-4">
          {/* Target Selector Bar */}
          <div className="bg-surface p-5 rounded-2xl border border-border shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2 p-1 bg-bg rounded-xl border border-border">
                <button
                  onClick={() => setMatrixTargetType('DEPARTMENT')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                    matrixTargetType === 'DEPARTMENT'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Departman Bazlı Yetki</span>
                </button>
                <button
                  onClick={() => setMatrixTargetType('USER')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                    matrixTargetType === 'USER'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Kullanıcıya Özel Yetki (Override)</span>
                </button>
              </div>

              {/* Target Picker */}
              <div className="flex items-center gap-3">
                {matrixTargetType === 'DEPARTMENT' ? (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-text-muted">Departman Seç:</label>
                    <select
                      value={selectedDeptIdForMatrix}
                      onChange={(e) => setSelectedDeptIdForMatrix(Number(e.target.value))}
                      className="px-3 py-2 text-xs font-bold bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-text-muted">Kullanıcı Seç:</label>
                    <select
                      value={selectedUserIdForMatrix}
                      onChange={(e) => setSelectedUserIdForMatrix(Number(e.target.value))}
                      className="px-3 py-2 text-xs font-bold bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-1 focus:ring-primary max-w-xs"
                    >
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name} ({u.email}) — [{u.department_name || 'Departmansız'}]
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {canUpdatePerms && (
                  <button
                    onClick={handleSaveMatrix}
                    disabled={matrixSaving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-success text-white text-xs font-bold rounded-xl shadow-sm hover:bg-emerald-700 transition active:scale-95 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>{matrixSaving ? 'Kaydediliyor...' : 'Yetkileri Kaydet'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Info Message */}
            <div className="p-3 bg-primary-soft/40 border border-primary/20 rounded-xl flex items-center justify-between text-xs text-text">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-primary shrink-0" />
                <span>
                  {matrixTargetType === 'DEPARTMENT'
                    ? 'Bu departmandaki tüm personel varsayılan olarak aşağıdaki yetkileri miras alır.'
                    : 'Kullanıcıya özel tanımlanan kutular, bağlı olduğu departmanın varsayılan yetkilerinin üstüne yazar (Override).'}
                </span>
              </div>
              {matrixSuccess && (
                <span className="text-success font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  {matrixSuccess}
                </span>
              )}
              {matrixError && (
                <span className="text-danger font-bold flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {matrixError}
                </span>
              )}
            </div>
          </div>

          {/* 5-Column Matrix Table */}
          <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-bg/90 border-b border-border text-text font-bold text-[11px]">
                    <th className="py-3 px-4 min-w-[220px]">Menü / Modül & Alt Ekran</th>
                    {actionsList.map((act) => (
                      <th key={act.id} className="py-3 px-3 text-center min-w-[100px]">
                        <button
                          type="button"
                          onClick={() => toggleAllForActionColumn(act.id)}
                          className="hover:underline font-bold text-text flex items-center justify-center gap-1 mx-auto"
                          title="Tüm sütunu aç/kapat"
                        >
                          <span>{act.name}</span>
                        </button>
                      </th>
                    ))}
                    <th className="py-3 px-3 text-center min-w-[90px]">Hızlı İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {modules.map((mod) => {
                    const modPerms = matrixData[mod.id] || {
                      read: false,
                      create: false,
                      update: false,
                      delete: false,
                      approve: false
                    };
                    return (
                      <tr key={mod.id} className="hover:bg-bg/40 transition">
                        <td className="py-2.5 px-4">
                          <div className="font-bold text-text">{mod.name}</div>
                          <div className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5">
                            <span className="font-mono text-primary font-bold">{mod.category}</span>
                            <span>•</span>
                            <span className="font-mono text-[9px]">{mod.id}</span>
                          </div>
                        </td>

                        {actionsList.map((act) => {
                          const isChecked = Boolean(modPerms[act.id]);
                          return (
                            <td key={act.id} className="py-2.5 px-3 text-center">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => togglePermissionCell(mod.id, act.id)}
                                  className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-bg peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary border border-border"></div>
                              </label>
                            </td>
                          );
                        })}

                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleAllActionsForModule(mod.id)}
                            className="text-[10px] px-2 py-1 rounded bg-bg text-text-muted hover:text-text hover:bg-surface border border-border font-medium transition"
                          >
                            Tümü
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SİSTEM & GÜVENLİK */}
      {/* ========================================================================= */}
      {activeTab === 'system' && (
        <div className="space-y-4">
          <div className="bg-surface p-6 rounded-2xl border border-border shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary-soft text-primary flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-text">Sıfır Güven (Zero-Trust) Güvenlik Mimarisi</h2>
                <p className="text-xs text-text-muted">
                  Kurumsal kimyasal üretim verileri, formülasyon reçeteleri ve müşteri hesapları katı güvenlik kalkanıyla korunmaktadır.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
              <div className="p-4 rounded-xl bg-bg border border-border space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-success">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Anti-Scraping Hız Sınırı</span>
                </div>
                <p className="text-xs text-text-muted">
                  Kullanıcı bazlı istek frekansı izlenir. Aşırı toplu veri çekme girişimlerinde oturum anında kilitlenir.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-bg border border-border space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-success">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Lisans & Domain Kilidi</span>
                </div>
                <p className="text-xs text-text-muted">
                  API ve frontend sadece lisanslı yetkili sunucu ve domainler üzerinde çalıştırılabilir.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-bg border border-border space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-success">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Katı B2B İzolasyonu</span>
                </div>
                <p className="text-xs text-text-muted">
                  Müşteri rolündeki hesaplar cari_id bazında tamamen izole edilmiştir. Başka firmalara erişim donanımsal olarak engellenir.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: KULLANICI EKLE / DÜZENLE */}
      {/* ========================================================================= */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl max-w-lg w-full overflow-hidden animate-scale-up">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-text text-sm">
                <Users className="w-4 h-4 text-primary" />
                <span>{editingUserId ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı Tanımla'}</span>
              </div>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text hover:bg-bg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Selector */}
            {!editingUserId && (
              <div className="p-3 bg-bg/50 border-b border-border flex gap-2">
                <button
                  type="button"
                  onClick={() => setUserModalMode('STAFF')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
                    userModalMode === 'STAFF' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Şirket Personeli</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUserModalMode('CUSTOMER')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
                    userModalMode === 'CUSTOMER' ? 'bg-emerald-600 text-white shadow-sm' : 'text-text-muted hover:text-text'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  <span>B2B Müşteri / Bayi</span>
                </button>
              </div>
            )}

            <form onSubmit={handleSaveUser} className="p-5 space-y-3.5">
              {formError && (
                <div className="p-2.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div className="p-2.5 rounded-xl bg-success/10 border border-success/20 text-success text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-text mb-1">Ad Soyad *</label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  placeholder="Örn: Ahmet Yılmaz"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text mb-1">E-Posta Adresi *</label>
                <input
                  type="email"
                  required
                  autoComplete="off"
                  placeholder="ahmet.yilmaz@gunaykimya.com"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {(!editingUserId || userPassword) && (
                <div>
                  <label className="block text-xs font-bold text-text mb-1">
                    {editingUserId ? 'Yeni Şifre (Boş bırakılırsa değişmez)' : 'Giriş Şifresi *'}
                  </label>
                  <input
                    type="password"
                    required={!editingUserId}
                    autoComplete="new-password"
                    placeholder="En az 6 karakter"
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              {userModalMode === 'STAFF' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-text mb-1">Departman *</label>
                    <select
                      value={userDeptId}
                      onChange={(e) => setUserDeptId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2 text-xs bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">-- Departman Seçin --</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text mb-1">Rol</label>
                    <select
                      value={userSystemRole}
                      onChange={(e) => setUserSystemRole(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="staff">Standart Personel</option>
                      <option value="admin">Sistem Yöneticisi (Admin)</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-text mb-1">Bağlı Cari Hesap (Firma) *</label>
                  <select
                    value={selectedCariId}
                    onChange={(e) => setSelectedCariId(e.target.value ? Number(e.target.value) : '')}
                    required
                    className="w-full px-3 py-2 text-xs bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">-- Cari Firma Seçiniz --</option>
                    {caris.map((c) => (
                      <option key={c.id} value={c.id}>
                        [{c.code}] {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="userActiveCheck"
                  checked={userIsActive}
                  onChange={(e) => setUserIsActive(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="userActiveCheck" className="text-xs font-bold text-text cursor-pointer">
                  Kullanıcı Aktif Olarak Başlasın
                </label>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-text-muted hover:text-text hover:bg-bg transition"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="px-5 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-sm hover:bg-[#241a63] transition disabled:opacity-50"
                >
                  {formSaving ? 'Kaydediliyor...' : editingUserId ? 'Değişiklikleri Kaydet' : 'Kullanıcıyı Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ŞİFRE SIFIRLA */}
      {/* ========================================================================= */}
      {isResetPwdModalOpen && resetTargetUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl max-w-sm w-full overflow-hidden animate-scale-up">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-text text-sm">
                <KeyRound className="w-4 h-4 text-amber-500" />
                <span>Şifre Sıfırlama</span>
              </div>
              <button
                onClick={() => setIsResetPwdModalOpen(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text hover:bg-bg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveResetPassword} className="p-5 space-y-4">
              {resetError && (
                <div className="p-2.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-bold">
                  {resetError}
                </div>
              )}
              {resetSuccess && (
                <div className="p-2.5 rounded-xl bg-success/10 border border-success/20 text-success text-xs font-bold">
                  {resetSuccess}
                </div>
              )}

              <div>
                <p className="text-xs text-text-muted mb-2">
                  <strong className="text-text">{resetTargetUser.full_name}</strong> ({resetTargetUser.email}) kullanıcısı için yeni bir giriş şifresi tanımlayın:
                </p>
                <input
                  type="password"
                  required
                  placeholder="Yeni şifre (en az 6 karakter)"
                  value={newPasswordVal}
                  onChange={(e) => setNewPasswordVal(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsResetPwdModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-text-muted hover:text-text"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={resetSaving}
                  className="px-5 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-amber-700 transition"
                >
                  {resetSaving ? 'Sıfırlanıyor...' : 'Şifreyi Güncelle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DEPARTMAN EKLE / DÜZENLE */}
      {/* ========================================================================= */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-border shadow-2xl max-w-md w-full overflow-hidden animate-scale-up">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-text text-sm">
                <Building2 className="w-4 h-4 text-primary" />
                <span>{editingDeptId ? 'Departmanı Düzenle' : 'Yeni Departman Ekle'}</span>
              </div>
              <button
                onClick={() => setIsDeptModalOpen(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text hover:bg-bg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDept} className="p-5 space-y-3.5">
              {deptError && (
                <div className="p-2.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-bold">
                  {deptError}
                </div>
              )}
              {deptSuccess && (
                <div className="p-2.5 rounded-xl bg-success/10 border border-success/20 text-success text-xs font-bold">
                  {deptSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-text mb-1">Departman Adı *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Ar-Ge ve Laboratuvar"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text mb-1">Departman Kodu (Kısa) *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: ARGE"
                  value={deptCode}
                  onChange={(e) => setDeptCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono uppercase bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text mb-1">Açıklama</label>
                <textarea
                  rows={2}
                  placeholder="Departmanın fabrika içi görev ve yetki alanı..."
                  value={deptDescription}
                  onChange={(e) => setDeptDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-bg border border-border rounded-xl text-text focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="deptActiveCheck"
                  checked={deptIsActive}
                  onChange={(e) => setDeptIsActive(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="deptActiveCheck" className="text-xs font-bold text-text cursor-pointer">
                  Departman Aktif
                </label>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-text-muted hover:text-text"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={deptSaving}
                  className="px-5 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-sm hover:bg-[#241a63] transition disabled:opacity-50"
                >
                  {deptSaving ? 'Kaydediliyor...' : editingDeptId ? 'Değişiklikleri Kaydet' : 'Departmanı Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default UserManagement;
