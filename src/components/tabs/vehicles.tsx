'use client';

import { useState } from 'react';
import { Plus, Truck, Edit2, Trash2, Info } from 'lucide-react';
import { useFetchData, useCreateData, useUpdateData, useDeleteData } from '@/hooks/use-data';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/helpers';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

interface VehicleItem {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  title: string;
  content: string;
}

const emptyForm: FormData = { title: '', content: '' };

export default function VehiclesTab() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<VehicleItem | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const { data: vehiclesData, isLoading } = useFetchData({
    model: 'note',
    filterField: 'category',
    filterValue: 'vehicle',
    sortBy: 'createdAt', sortOrder: 'desc',
  });

  const createData = useCreateData();
  const updateData = useUpdateData();
  const deleteData = useDeleteData();

  const vehicles: VehicleItem[] = vehiclesData?.data || [];

  const handleCreate = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast({ title: 'Validation Error', description: 'Vehicle name and details are required.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await createData.mutateAsync({
        model: 'note',
        data: {
          title: form.title.trim(),
          content: form.content.trim(),
          category: 'vehicle',
        },
      });
      toast({ title: 'Vehicle added', description: 'New vehicle has been added successfully.' });
      setAddOpen(false);
      setForm(emptyForm);
    } catch {
      toast({ title: 'Error', description: 'Failed to add vehicle.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedItem || !form.title.trim() || !form.content.trim()) {
      toast({ title: 'Validation Error', description: 'Vehicle name and details are required.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await updateData.mutateAsync({
        model: 'note',
        id: selectedItem.id,
        data: {
          title: form.title.trim(),
          content: form.content.trim(),
        },
      });
      toast({ title: 'Vehicle updated', description: 'Vehicle details have been saved.' });
      setEditOpen(false);
      setSelectedItem(null);
      setForm(emptyForm);
    } catch {
      toast({ title: 'Error', description: 'Failed to update vehicle.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    setSubmitting(true);
    try {
      await deleteData.mutateAsync({ model: 'note', id: selectedItem.id });
      toast({ title: 'Vehicle deleted', description: 'The vehicle has been removed.' });
      setDeleteOpen(false);
      setSelectedItem(null);
    } catch {
      toast({ title: 'Error', description: 'Failed to delete vehicle.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (item: VehicleItem) => {
    setSelectedItem(item);
    setForm({ title: item.title, content: item.content });
    setEditOpen(true);
  };

  const openDelete = (item: VehicleItem) => {
    setSelectedItem(item);
    setDeleteOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Vehicles</h2>
          <p className="text-sm text-muted-foreground">Manage your vehicle fleet</p>
        </div>
        <Button
          onClick={() => { setForm(emptyForm); setAddOpen(true); }}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Vehicle
        </Button>
      </div>

      {/* Info banner */}
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="flex items-start gap-3 p-4">
          <Truck className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            Manage your vehicle fleet. Add vehicles or use AI Chat commands for quick additions.
          </p>
        </CardContent>
      </Card>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : vehicles.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No vehicles registered"
          description="Start adding vehicles to track your fleet and operations."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Details</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((item: VehicleItem) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium">{item.title}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell max-w-xs truncate text-muted-foreground">
                      {item.content.length > 80 ? item.content.substring(0, 80) + '...' : item.content}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(item.createdAt, 'DD/MM/YYYY')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(item)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => openDelete(item)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Add Vehicle Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => { if (!open) setForm(emptyForm); setAddOpen(open); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Vehicle</DialogTitle>
            <DialogDescription>Add a new vehicle to your fleet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Vehicle Name *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Tata Ace, JCB 3DX, etc."
              />
            </div>
            <div className="space-y-2">
              <Label>Details *</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Vehicle details, registration number, driver info, etc."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setForm(emptyForm); setAddOpen(false); }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={submitting || !form.title.trim() || !form.content.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? 'Adding...' : 'Add Vehicle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Vehicle Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) { setSelectedItem(null); setForm(emptyForm); } setEditOpen(open); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Vehicle</DialogTitle>
            <DialogDescription>Update the vehicle details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Vehicle Name *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Tata Ace, JCB 3DX, etc."
              />
            </div>
            <div className="space-y-2">
              <Label>Details *</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Vehicle details, registration number, driver info, etc."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedItem(null); setForm(emptyForm); setEditOpen(false); }}>
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={submitting || !form.title.trim() || !form.content.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (!open) setSelectedItem(null); setDeleteOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vehicle</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedItem?.title}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={submitting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {submitting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
