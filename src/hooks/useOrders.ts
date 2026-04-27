/**
 * useOrders — list / detail / status update for cross-tenant orders.
 *
 * Differences from previous stub shape:
 *   - Order fields are snake_case (customer_name, customer_contact,
 *     requested_part_name, oem_number, vehicle_description, merchant_id,
 *     created_at, updated_at, notes). No `total`, no `tenantName`.
 *   - status union is now OrderStatus from API ('new', 'in_progress',
 *     'awaiting_parts', 'ready', 'done', 'archived', 'cancelled').
 *   - useOrder(id) fetches a single order.
 *   - Use useUpdateOrderStatus for status-only changes; useUpdateOrder
 *     for arbitrary patches.
 */

import {
    useQuery,
    useMutation,
    useQueryClient,
    type UseMutationResult,
    type UseQueryResult,
} from '@tanstack/react-query';
import { listAllOrders, getOrder, updateOrderStatus, updateOrder } from '@/api/orders';
import type { Order, OrderStatus } from '@/api/types';

const ORDERS_KEY = ['admin', 'orders'] as const;
const orderKey = (id: string): readonly unknown[] => ['admin', 'orders', id] as const;

export type AdminOrder = Order;

const READ_OPTIONS = { staleTime: 30_000, gcTime: 5 * 60_000 } as const;

export function useOrders(): {
    orders: Order[];
    isLoading: boolean;
    error: unknown;
    refetch: () => void;
} {
    const q = useQuery({
        queryKey: ORDERS_KEY,
        queryFn: () => listAllOrders(),
        ...READ_OPTIONS,
    });
    return {
        orders: q.data ?? [],
        isLoading: q.isLoading,
        error: q.error,
        refetch: () => void q.refetch(),
    };
}

export function useOrder(orderId: string | null | undefined): UseQueryResult<Order, Error> {
    return useQuery({
        queryKey: orderId ? orderKey(orderId) : ['admin', 'orders', '__none__'],
        queryFn: () => getOrder(orderId as string),
        enabled: !!orderId,
        ...READ_OPTIONS,
    });
}

export interface UpdateOrderStatusInput {
    id: string;
    status: OrderStatus;
}

export function useUpdateOrderStatus(): UseMutationResult<Order, Error, UpdateOrderStatusInput> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, status }) => updateOrderStatus(id, status),
        onSuccess: (data, vars) => {
            qc.setQueryData(orderKey(vars.id), data);
            void qc.invalidateQueries({ queryKey: ORDERS_KEY });
        },
    });
}

export interface UpdateOrderInput {
    id: string;
    patch: Partial<
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
    >;
}

export function useUpdateOrder(): UseMutationResult<Order, Error, UpdateOrderInput> {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, patch }) => updateOrder(id, patch),
        onSuccess: (data, vars) => {
            qc.setQueryData(orderKey(vars.id), data);
            void qc.invalidateQueries({ queryKey: ORDERS_KEY });
        },
    });
}
