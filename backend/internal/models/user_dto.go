package models

// CreateUserRequest is the payload for creating a new user.
type CreateUserRequest struct {
	Name     string `json:"name" validate:"required,min=2,max=255"`
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=6,max=128"`
	RoleCode string `json:"role_code" validate:"required,oneof=SUPER_ADMIN ADMIN WORKER"`
	IsAdmin  bool   `json:"is_admin"`
}

// UpdateUserRequest is the payload for updating an existing user.
type UpdateUserRequest struct {
	Name     string `json:"name,omitempty" validate:"omitempty,min=2,max=255"`
	RoleCode string `json:"role_code,omitempty" validate:"omitempty,oneof=SUPER_ADMIN ADMIN WORKER"`
	IsActive *bool  `json:"is_active,omitempty"`
	IsAdmin  *bool  `json:"is_admin,omitempty"`
}

// UserListRow is a single row in the users listing.
type UserListRow struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	RoleCode  string `json:"role_code"`
	RoleName  string `json:"role_name"`
	IsActive  bool   `json:"is_active"`
	IsAdmin   bool   `json:"is_admin"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// UserCreateResult is the result returned after creating a user.
type UserCreateResult struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Email    string `json:"email"`
	RoleCode string `json:"role_code"`
	IsAdmin  bool   `json:"is_admin"`
}
