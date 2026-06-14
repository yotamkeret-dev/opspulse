import type { MappingTemplate } from './types';
import type { createClient } from '@/lib/supabase/client';

type SupabaseClient = ReturnType<typeof createClient>;

// ─── Supabase CRUD ────────────────────────────────────────────────────────

export async function fetchTemplates(supabase: SupabaseClient): Promise<MappingTemplate[]> {
  const { data, error } = await supabase
    .from('import_templates')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error('fetchTemplates:', error.message); return []; }

  return (data ?? []).map(rowToTemplate);
}

export async function saveTemplate(
  supabase: SupabaseClient,
  template: Omit<MappingTemplate, 'id' | 'createdAt'> & { createdBy: string }
): Promise<MappingTemplate> {
  const id = `tpl-${Date.now()}`;
  const { data, error } = await supabase
    .from('import_templates')
    .insert({
      id,
      name:           template.name,
      description:    template.description,
      target_schema:  template.targetSchema,
      field_mappings: template.fieldMappings,
      created_by:     template.createdBy,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToTemplate(data);
}

export async function deleteTemplate(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase
    .from('import_templates')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Seed default Oracle PO template ─────────────────────────────────────
// Called on first load if no templates exist for this schema.

export const ORACLE_PO_DEFAULT_TEMPLATE: Omit<MappingTemplate, 'id' | 'createdAt'> = {
  name:         'Oracle PO Export (default)',
  description:  'Standard Oracle Purchase Order CSV/Excel/PDF export. Covers PO Number, Supplier, Date, Amount, Status, Requester.',
  targetSchema: 'procurement',
  fieldMappings: [
    { sourceColumn: 'PO_NUMBER',     targetField: 'poNumber'      },
    { sourceColumn: 'SUPPLIER',      targetField: 'supplier'      },
    { sourceColumn: 'VENDOR_NAME',   targetField: 'supplier'      },
    { sourceColumn: 'PO_DATE',       targetField: 'date'          },
    { sourceColumn: 'TOTAL',         targetField: 'amountUsd'     },
    { sourceColumn: 'STATUS',        targetField: 'status'        },
    { sourceColumn: 'REQUESTER',     targetField: 'employeeName'  },
    { sourceColumn: 'REQUESTER_NAME',targetField: 'employeeName'  },
    { sourceColumn: 'LINE_ITEMS',    targetField: 'notes'         },
    { sourceColumn: 'DESCRIPTION',   targetField: 'notes'         },
  ],
};

// ─── Internal helpers ─────────────────────────────────────────────────────

function rowToTemplate(row: Record<string, unknown>): MappingTemplate {
  return {
    id:           String(row.id),
    name:         String(row.name),
    description:  String(row.description ?? ''),
    targetSchema: String(row.target_schema),
    fieldMappings: (row.field_mappings as MappingTemplate['fieldMappings']) ?? [],
    createdBy:    row.created_by ? String(row.created_by) : undefined,
    createdAt:    String(row.created_at),
  };
}
