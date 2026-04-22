package models

// CreateUserRequest is the payload for creating a new user.
type CreateUserRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8,max=128"`
	RoleCode string `json:"role_code" validate:"required,oneof=ADMIN MANAGER STAFF"`
}

// UpdateUserRequest is the payload for updating an existing user.
type UpdateUserRequest struct {
	RoleCode string `json:"role_code,omitempty" validate:"omitempty,oneof=ADMIN MANAGER STAFF"`
	IsActive *bool  `json:"is_active,omitempty"`
}

type ChangePasswordRequest struct {
	Password string `json:"password" validate:"required,min=8,max=128"`
}

// UserListRow is a single row in the users listing.
type UserListRow struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	RoleCode  string `json:"role_code"`
	RoleName  string `json:"role_name"`
	IsActive  bool   `json:"is_active"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// UserCreateResult is the result returned after creating a user.
type UserCreateResult struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	RoleCode string `json:"role_code"`
	IsActive bool   `json:"is_active"`
}

type UserSafeProfile struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	RoleCode  string `json:"role_code"`
	RoleName  string `json:"role_name"`
	IsActive  bool   `json:"is_active"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}
