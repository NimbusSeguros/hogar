import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 🔥 PARCHE GLOBAL PARA NODE 20 (Supabase necesita WebSocket nativo)
const WS = require('ws');
(globalThis as any).WebSocket = WS.WebSocket || WS;

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Faltan variables de entorno de Supabase: SUPABASE_URL y SUPABASE_KEY');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

export class SupabaseProvider {
  /**
   * List of all supported insurance tables
   */
  static TABLES = ['hogar', 'bicicleta', 'notebook', 'monopatin'];

  /**
   * Saves or updates an insurance order in the specified table
   */
  static async saveOrder(tableName: string, data: any) {
    const { id, ...updateData } = data;

    try {
      if (id) {
        const { data: result, error } = await supabase
          .from(tableName)
          .update(updateData)
          .eq('id', id)
          .select()
          .single();
        
        if (error) throw error;
        return result;
      } else {
        const { data: result, error } = await supabase
          .from(tableName)
          .insert([updateData])
          .select()
          .single();
        
        if (error) throw error;
        return result;
      }
    } catch (error: any) {
      console.error(`Error saving order in Supabase table ${tableName}:`, error.message);
      throw error;
    }
  }

  /**
   * Retrieves an order by its RUS order ID from a specific table
   */
  static async getOrderByRusId(tableName: string, orderIdRus: string) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('order_id_rus', orderIdRus)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error: any) {
      console.error(`Error fetching order from Supabase table ${tableName}:`, error.message);
      throw error;
    }
  }

  /**
   * Searches for an order by RUS ID across all known tables
   */
  static async findOrderAnywhere(orderIdRus: string) {
    try {
      for (const table of this.TABLES) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('order_id_rus', orderIdRus)
          .maybeSingle(); // maybeSingle doesn't error on 0 results
        
        if (data) return { data, tableName: table };
      }
      return null;
    } catch (error: any) {
      console.error('Error searching order across tables:', error.message);
      return null;
    }
  }

  // Backward compatibility wrapper (optional, but good to have during transition)
  static async saveHogarOrder(data: any) {
    return this.saveOrder('hogar', data);
  }
}
