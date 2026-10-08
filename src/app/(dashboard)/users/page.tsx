'use client';
import { useDeferredEffect } from '@/lib/useDeferredEffect';

import { Header } from '@/components/dashboard/header';
import { Avatar,AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
Dialog,
DialogContent,
DialogFooter,
DialogHeader,
DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
Table,
TableCell,
TableHead,
TableHeader,
TableRow
} from '@/components/ui/table';
import { api } from '@/lib/api';
import { useRequireRole } from '@/lib/useRequireRole';
import { cn } from '@/lib/utils';
import { AnimatePresence,motion,type Variants } from 'framer-motion';
import { Ban,CheckCircle2,Pencil,Users as UsersIcon } from 'lucide-react';
import { useCallback,useState } from 'react';

interface User { id: string; email: string; full_name: string; nik: string; role: string; is_active: number; last_login: string; created_at: string; }

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
};

const fieldVariants: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
};

function initialsOf(name: string) {
  return (name || 'U')
    .split(' ')
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function roleBadgeVariant(role: string): 'default' | 'secondary' | 'outline' {
  if (role === 'superadmin' || role === 'admin') return 'default';
  if (role === 'supervisor') return 'secondary';
  return 'outline';
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 md:space-y-5">
      <div>
        <Skeleton className="h-7 w-48 rounded-md" />
        <Skeleton className="mt-2 h-4 w-72 rounded-md" />
      </div>
      <Card className="p-4 md:p-5">
        <Skeleton className="h-64 w-full rounded-md" />
      </Card>
    </div>
  );
}

export default function UsersPage() {
  const { checking, allowed } = useRequireRole(['superadmin']);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', nik: '', role: 'verifikator' });
  const [error, setError] = useState('');

  const loadUsers = useCallback(async () => { try { setLoading(true); const d = await api.getUsers<{users: User[]}>(); setUsers(d.users); } catch (err) { console.error('[Users] Gagal memuat user:', err); } finally { setLoading(false); } }, []);

  useDeferredEffect(() => { if (allowed) loadUsers(); }, [allowed, loadUsers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      if (editUser) {
        const data: Record<string, unknown> = { full_name: form.full_name, nik: form.nik, role: form.role };
        if (form.password) data.password = form.password;
        await api.updateUser(editUser.id, data);
      } else {
        await api.createUser(form);
      }
      setShowModal(false); setEditUser(null);
      setForm({ email: '', password: '', full_name: '', nik: '', role: 'verifikator' });
      loadUsers();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Gagal menyimpan'); }
  };

  const handleEdit = (u: User) => {
    setEditUser(u);
    setForm({ email: u.email, password: '', full_name: u.full_name, nik: u.nik || '', role: u.role });
    setShowModal(true);
  };

  const handleToggle = async (u: User) => {
    try { await api.updateUser(u.id, { is_active: !u.is_active }); loadUsers(); } catch (err) { console.error('[Users] Gagal toggle user:', err); }
  };

  const openCreateModal = () => {
    setEditUser(null);
    setForm({ email: '', password: '', full_name: '', nik: '', role: 'verifikator' });
    setShowModal(true);
  };

  if (checking || !allowed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }
  if (loading) return <LoadingSkeleton />;

  return (
    <motion.div
      className="space-y-4 md:space-y-5"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <Header
        title="Manajemen User"
        description={`${users.length} user terdaftar`}
        actions={
          <Button onClick={openCreateModal}>
            + Tambah User
          </Button>
        }
      />

      <Card className="p-0 overflow-hidden">
        <Table className="table-zebra">
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>NIK</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Login Terakhir</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <motion.tbody variants={containerVariants} initial="hidden" animate="visible">
            <AnimatePresence>
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <UsersIcon className="h-8 w-8 text-muted-foreground/50" />
                      Belum ada user terdaftar
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {users.map((u) => (
                <motion.tr
                  key={u.id}
                  variants={rowVariants}
                  layout
                  exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                  className="hover:bg-muted/50 border-b transition-colors last:border-0"
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                          {initialsOf(u.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-foreground">{u.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{u.nik || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={roleBadgeVariant(u.role)} className="capitalize">
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={u.is_active ? 'default' : 'destructive'}
                      className={cn(!u.is_active && 'bg-destructive/10 text-destructive border-destructive/20')}
                    >
                      {u.is_active ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.last_login ? new Date(u.last_login).toLocaleString('id-ID') : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => handleEdit(u)}
                        title="Edit user"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => handleToggle(u)}
                        title={u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        className={u.is_active ? 'hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30' : 'hover:bg-primary/10 hover:text-primary hover:border-primary/30'}
                      >
                        {u.is_active ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </TableCell>
                </motion.tr>
              ))}
            </AnimatePresence>
          </motion.tbody>
        </Table>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editUser ? 'Edit User' : 'Tambah User Baru'}</DialogTitle>
          </DialogHeader>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -8 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.form
            onSubmit={handleSubmit}
            className="space-y-4"
            variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
            initial="hidden"
            animate="visible"
          >
            <motion.div className="space-y-1.5" variants={fieldVariants}>
              <Label htmlFor="full_name">Nama Lengkap</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
              />
            </motion.div>

            <motion.div className="space-y-1.5" variants={fieldVariants}>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                disabled={!!editUser}
              />
            </motion.div>

            <motion.div className="space-y-1.5" variants={fieldVariants}>
              <Label htmlFor="password">
                {editUser ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password'}
              </Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={!editUser}
                minLength={8}
              />
            </motion.div>

            <motion.div className="space-y-1.5" variants={fieldVariants}>
              <Label htmlFor="nik">NIK</Label>
              <Input
                id="nik"
                value={form.nik}
                onChange={(e) => setForm({ ...form, nik: e.target.value })}
              />
            </motion.div>

            <motion.div className="space-y-1.5" variants={fieldVariants}>
              <Label htmlFor="role">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger id="role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="verifikator">Verifikator</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="superadmin">Superadmin</SelectItem>
                </SelectContent>
              </Select>
            </motion.div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Batal
              </Button>
              <Button type="submit">Simpan</Button>
            </DialogFooter>
          </motion.form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
