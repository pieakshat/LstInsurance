export const FACTORY_ABI = [
  {
    "type": "impl",
    "name": "UpgradeableImpl",
    "interface_name": "openzeppelin_interfaces::upgrades::IUpgradeable"
  },
  {
    "type": "interface",
    "name": "openzeppelin_interfaces::upgrades::IUpgradeable",
    "items": [
      {
        "type": "function",
        "name": "upgrade",
        "inputs": [
          {
            "name": "new_class_hash",
            "type": "core::starknet::class_hash::ClassHash"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      }
    ]
  },
  {
    "type": "impl",
    "name": "InsuranceVaultFactoryImpl",
    "interface_name": "contracts::vault_factory::IInsuranceVaultFactory"
  },
  {
    "type": "struct",
    "name": "core::integer::u256",
    "members": [
      {
        "name": "low",
        "type": "core::integer::u128"
      },
      {
        "name": "high",
        "type": "core::integer::u128"
      }
    ]
  },
  {
    "type": "struct",
    "name": "core::byte_array::ByteArray",
    "members": [
      {
        "name": "data",
        "type": "core::array::Array::<core::bytes_31::bytes31>"
      },
      {
        "name": "pending_word",
        "type": "core::felt252"
      },
      {
        "name": "pending_word_len",
        "type": "core::internal::bounded_int::BoundedInt::<0, 30>"
      }
    ]
  },
  {
    "type": "interface",
    "name": "contracts::vault_factory::IInsuranceVaultFactory",
    "items": [
      {
        "type": "function",
        "name": "create_vault",
        "inputs": [
          {
            "name": "protocol_id",
            "type": "core::integer::u256"
          },
          {
            "name": "name",
            "type": "core::byte_array::ByteArray"
          },
          {
            "name": "symbol",
            "type": "core::byte_array::ByteArray"
          },
          {
            "name": "underlying_asset",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [
          {
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "set_vault_class_hash",
        "inputs": [
          {
            "name": "new_hash",
            "type": "core::starknet::class_hash::ClassHash"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "set_premium_class_hash",
        "inputs": [
          {
            "name": "new_hash",
            "type": "core::starknet::class_hash::ClassHash"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "set_registry",
        "inputs": [
          {
            "name": "new_registry",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "set_coverage_token",
        "inputs": [
          {
            "name": "token",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "set_premium_asset",
        "inputs": [
          {
            "name": "asset",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "get_premium_asset",
        "inputs": [],
        "outputs": [
          {
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_vault",
        "inputs": [
          {
            "name": "protocol_id",
            "type": "core::integer::u256"
          }
        ],
        "outputs": [
          {
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_premium_module",
        "inputs": [
          {
            "name": "protocol_id",
            "type": "core::integer::u256"
          }
        ],
        "outputs": [
          {
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_protocol",
        "inputs": [
          {
            "name": "vault",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [
          {
            "type": "core::integer::u256"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "all_vaults",
        "inputs": [],
        "outputs": [
          {
            "type": "core::array::Array::<core::starknet::contract_address::ContractAddress>"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "vault_count",
        "inputs": [],
        "outputs": [
          {
            "type": "core::integer::u32"
          }
        ],
        "state_mutability": "view"
      }
    ]
  },
  {
    "type": "impl",
    "name": "AccessControlImpl",
    "interface_name": "openzeppelin_interfaces::access::accesscontrol::IAccessControl"
  },
  {
    "type": "enum",
    "name": "core::bool",
    "variants": [
      {
        "name": "False",
        "type": "()"
      },
      {
        "name": "True",
        "type": "()"
      }
    ]
  },
  {
    "type": "interface",
    "name": "openzeppelin_interfaces::access::accesscontrol::IAccessControl",
    "items": [
      {
        "type": "function",
        "name": "has_role",
        "inputs": [
          {
            "name": "role",
            "type": "core::felt252"
          },
          {
            "name": "account",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [
          {
            "type": "core::bool"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_role_admin",
        "inputs": [
          {
            "name": "role",
            "type": "core::felt252"
          }
        ],
        "outputs": [
          {
            "type": "core::felt252"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "grant_role",
        "inputs": [
          {
            "name": "role",
            "type": "core::felt252"
          },
          {
            "name": "account",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "revoke_role",
        "inputs": [
          {
            "name": "role",
            "type": "core::felt252"
          },
          {
            "name": "account",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "renounce_role",
        "inputs": [
          {
            "name": "role",
            "type": "core::felt252"
          },
          {
            "name": "account",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      }
    ]
  },
  {
    "type": "constructor",
    "name": "constructor",
    "inputs": [
      {
        "name": "registry",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "vault_class_hash",
        "type": "core::starknet::class_hash::ClassHash"
      },
      {
        "name": "premium_class_hash",
        "type": "core::starknet::class_hash::ClassHash"
      },
      {
        "name": "coverage_token",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "owner",
        "type": "core::starknet::contract_address::ContractAddress"
      }
    ]
  },
  {
    "type": "event",
    "name": "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleGranted",
    "kind": "struct",
    "members": [
      {
        "name": "role",
        "type": "core::felt252",
        "kind": "data"
      },
      {
        "name": "account",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      },
      {
        "name": "sender",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleGrantedWithDelay",
    "kind": "struct",
    "members": [
      {
        "name": "role",
        "type": "core::felt252",
        "kind": "data"
      },
      {
        "name": "account",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      },
      {
        "name": "sender",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      },
      {
        "name": "delay",
        "type": "core::integer::u64",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleRevoked",
    "kind": "struct",
    "members": [
      {
        "name": "role",
        "type": "core::felt252",
        "kind": "data"
      },
      {
        "name": "account",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      },
      {
        "name": "sender",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleAdminChanged",
    "kind": "struct",
    "members": [
      {
        "name": "role",
        "type": "core::felt252",
        "kind": "data"
      },
      {
        "name": "previous_admin_role",
        "type": "core::felt252",
        "kind": "data"
      },
      {
        "name": "new_admin_role",
        "type": "core::felt252",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::Event",
    "kind": "enum",
    "variants": [
      {
        "name": "RoleGranted",
        "type": "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleGranted",
        "kind": "nested"
      },
      {
        "name": "RoleGrantedWithDelay",
        "type": "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleGrantedWithDelay",
        "kind": "nested"
      },
      {
        "name": "RoleRevoked",
        "type": "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleRevoked",
        "kind": "nested"
      },
      {
        "name": "RoleAdminChanged",
        "type": "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleAdminChanged",
        "kind": "nested"
      }
    ]
  },
  {
    "type": "event",
    "name": "openzeppelin_introspection::src5::SRC5Component::Event",
    "kind": "enum",
    "variants": []
  },
  {
    "type": "event",
    "name": "openzeppelin_upgrades::upgradeable::UpgradeableComponent::Upgraded",
    "kind": "struct",
    "members": [
      {
        "name": "class_hash",
        "type": "core::starknet::class_hash::ClassHash",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "openzeppelin_upgrades::upgradeable::UpgradeableComponent::Event",
    "kind": "enum",
    "variants": [
      {
        "name": "Upgraded",
        "type": "openzeppelin_upgrades::upgradeable::UpgradeableComponent::Upgraded",
        "kind": "nested"
      }
    ]
  },
  {
    "type": "event",
    "name": "contracts::vault_factory::InsuranceVaultFactory::VaultCreated",
    "kind": "struct",
    "members": [
      {
        "name": "protocol_id",
        "type": "core::integer::u256",
        "kind": "key"
      },
      {
        "name": "vault",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      },
      {
        "name": "premium_module",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      },
      {
        "name": "asset",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "contracts::vault_factory::InsuranceVaultFactory::VaultClassUpdated",
    "kind": "struct",
    "members": [
      {
        "name": "new_class_hash",
        "type": "core::starknet::class_hash::ClassHash",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "contracts::vault_factory::InsuranceVaultFactory::PremiumClassUpdated",
    "kind": "struct",
    "members": [
      {
        "name": "new_class_hash",
        "type": "core::starknet::class_hash::ClassHash",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "contracts::vault_factory::InsuranceVaultFactory::Event",
    "kind": "enum",
    "variants": [
      {
        "name": "AccessControlEvent",
        "type": "openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::Event",
        "kind": "flat"
      },
      {
        "name": "SRC5Event",
        "type": "openzeppelin_introspection::src5::SRC5Component::Event",
        "kind": "flat"
      },
      {
        "name": "UpgradeableEvent",
        "type": "openzeppelin_upgrades::upgradeable::UpgradeableComponent::Event",
        "kind": "flat"
      },
      {
        "name": "VaultCreated",
        "type": "contracts::vault_factory::InsuranceVaultFactory::VaultCreated",
        "kind": "nested"
      },
      {
        "name": "VaultClassUpdated",
        "type": "contracts::vault_factory::InsuranceVaultFactory::VaultClassUpdated",
        "kind": "nested"
      },
      {
        "name": "PremiumClassUpdated",
        "type": "contracts::vault_factory::InsuranceVaultFactory::PremiumClassUpdated",
        "kind": "nested"
      }
    ]
  }
] as const;
