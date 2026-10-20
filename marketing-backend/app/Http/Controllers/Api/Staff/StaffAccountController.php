<?php

namespace App\Http\Controllers\Api\Staff;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\StoreStaffAccountRequest;
use App\Http\Requests\Staff\UpdateStaffAccountRequest;
use App\Http\Resources\StaffAccountResource;
use App\Models\StaffUser;
use App\Services\StaffAccountService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Super-admin management of staff accounts (identity hub). Routes are guarded by
 * auth:staff_api and staff.super_admin.
 */
class StaffAccountController extends Controller
{
    public function __construct(
        protected StaffAccountService $accounts,
    ) {}

    public function index(): JsonResponse
    {
        $staff = StaffUser::query()->orderBy('name')->get();

        return $this->ok(StaffAccountResource::collection($staff));
    }

    public function store(StoreStaffAccountRequest $request): JsonResponse
    {
        $staff = $this->accounts->create($request->validated(), $this->actor($request));

        return $this->ok(new StaffAccountResource($staff), 'Staff account created.', 201);
    }

    public function update(UpdateStaffAccountRequest $request, StaffUser $staff): JsonResponse
    {
        $staff = $this->accounts->update($staff, $request->validated(), $this->actor($request));

        return $this->ok(new StaffAccountResource($staff), 'Staff account updated.');
    }

    public function disable(Request $request, StaffUser $staff): JsonResponse
    {
        $actor = $this->actor($request);

        if ($actor->is($staff)) {
            throw ValidationException::withMessages(['staff' => 'You cannot disable your own account.']);
        }

        $staff = $this->accounts->disable($staff, $actor);

        return $this->ok(new StaffAccountResource($staff), 'Staff account disabled.');
    }

    public function enable(Request $request, StaffUser $staff): JsonResponse
    {
        $staff = $this->accounts->enable($staff, $this->actor($request));

        return $this->ok(new StaffAccountResource($staff), 'Staff account re-enabled.');
    }

    private function actor(Request $request): StaffUser
    {
        /** @var StaffUser $actor */
        $actor = $request->user('staff_api');

        return $actor;
    }

    private function ok(mixed $data, string $message = 'OK', int $status = 200): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $data,
            'message' => $message,
            'errors' => null,
        ], $status);
    }
}
