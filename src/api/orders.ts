/**
 * Orders API — list all orders across tenants, update status.
 */

import { apiFetch } from './client';
import { OrderSchema, parseApiResponse, type Order, type OrderStatus } from './types';
import { z } from 'zod';

export async function listAllOrders(): Promise<Order[]> {
    const raw = await apiFetch<unknown>('/api/admin/orders');
    const parsed = z.array(OrderSchema).safeParse(raw);
    return parsed.success ? parsed.data : [];
}

export async function getOrder(orderId: string): Promise<Order> {
    const raw = await apiFetch<unknown>(`/api/orders/${orderId}`);
    return parseApiResponse(OrderSchema, raw);
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
    const raw = await apiFetch<unknown>(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    });
    return parseApiResponse(OrderSchema, raw);
}

export async function updateOrder(
    orderId: string,
    data: Partial<
        Pick<
            Order,
            | 'status'
            | 'customer_name'
            | 'customer_contact'
            | 'notes'
            | 'oem_number'
            | 'requested_part_name'
            | 'vehicle_description'
        >
    >
): Promise<Order> {
    const raw = await apiFetch<unknown>(`/api/orders/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    });
    return parseApiResponse(OrderSchema, raw);
}
