export const REGISTRY_ABI = [
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
    "name": "ProtocolRegistryImpl",
    "interface_name": "contracts::protocol_registry::IProtocolRegistry"
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
    "type": "struct",
    "name": "contracts::protocol_registry::ProtocolInfo",
    "members": [
      {
        "name": "protocol_id",
        "type": "core::integer::u256"
      },
      {
        "name": "protocol_address",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "vault",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "active",
        "type": "core::bool"
      },
      {
        "name": "coverage_cap",
        "type": "core::integer::u256"
      },
      {
        "name": "premium_rate",
        "type": "core::integer::u256"
      }
    ]
  },
  {
    "type": "interface",
    "name": "contracts::protocol_registry::IProtocolRegistry",
    "items": [
      {
        "type": "function",
        "name": "register_protocol",
        "inputs": [
          {
            "name": "protocol_address",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "vault",
            "type": "core::starknet::contract_address::ContractAddress"
          },
          {
            "name": "coverage_cap",
            "type": "core::integer::u256"
          },
          {
            "name": "premium_rate",
            "type": "core::integer::u256"
          }
        ],
        "outputs": [
          {
            "type": "core::integer::u256"
          }
        ],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "set_vault",
        "inputs": [
          {
            "name": "protocol_id",
            "type": "core::integer::u256"
          },
          {
            "name": "vault",
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "set_coverage_params",
        "inputs": [
          {
            "name": "protocol_id",
            "type": "core::integer::u256"
          },
          {
            "name": "coverage_cap",
            "type": "core::integer::u256"
          },
          {
            "name": "premium_rate",
            "type": "core::integer::u256"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "pause_protocol",
        "inputs": [
          {
            "name": "protocol_id",
            "type": "core::integer::u256"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "activate_protocol",
        "inputs": [
          {
            "name": "protocol_id",
            "type": "core::integer::u256"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "set_governance",
        "inputs": [
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
        "name": "get_protocol",
        "inputs": [
          {
            "name": "protocol_id",
            "type": "core::integer::u256"
          }
        ],
        "outputs": [
          {
            "type": "contracts::protocol_registry::ProtocolInfo"
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
        "name": "get_protocol_id",
        "inputs": [
          {
            "name": "protocol_address",
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
        "name": "is_active",
        "inputs": [
          {
            "name": "protocol_id",
            "type": "core::integer::u256"
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
        "name": "protocol_count",
        "inputs": [],
        "outputs": [
          {
            "type": "core::integer::u256"
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
    "name": "contracts::protocol_registry::ProtocolRegistry::ProtocolRegistered",
    "kind": "struct",
    "members": [
      {
        "name": "protocol_id",
        "type": "core::integer::u256",
        "kind": "key"
      },
      {
        "name": "protocol_address",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      },
      {
        "name": "vault",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      },
      {
        "name": "coverage_cap",
        "type": "core::integer::u256",
        "kind": "data"
      },
      {
        "name": "premium_rate",
        "type": "core::integer::u256",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "contracts::protocol_registry::ProtocolRegistry::ProtocolPaused",
    "kind": "struct",
    "members": [
      {
        "name": "protocol_id",
        "type": "core::integer::u256",
        "kind": "key"
      }
    ]
  },
  {
    "type": "event",
    "name": "contracts::protocol_registry::ProtocolRegistry::ProtocolActivated",
    "kind": "struct",
    "members": [
      {
        "name": "protocol_id",
        "type": "core::integer::u256",
        "kind": "key"
      }
    ]
  },
  {
    "type": "event",
    "name": "contracts::protocol_registry::ProtocolRegistry::VaultUpdated",
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
      }
    ]
  },
  {
    "type": "event",
    "name": "contracts::protocol_registry::ProtocolRegistry::CoverageParamsUpdated",
    "kind": "struct",
    "members": [
      {
        "name": "protocol_id",
        "type": "core::integer::u256",
        "kind": "key"
      },
      {
        "name": "coverage_cap",
        "type": "core::integer::u256",
        "kind": "data"
      },
      {
        "name": "premium_rate",
        "type": "core::integer::u256",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "contracts::protocol_registry::ProtocolRegistry::Event",
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
        "name": "ProtocolRegistered",
        "type": "contracts::protocol_registry::ProtocolRegistry::ProtocolRegistered",
        "kind": "nested"
      },
      {
        "name": "ProtocolPaused",
        "type": "contracts::protocol_registry::ProtocolRegistry::ProtocolPaused",
        "kind": "nested"
      },
      {
        "name": "ProtocolActivated",
        "type": "contracts::protocol_registry::ProtocolRegistry::ProtocolActivated",
        "kind": "nested"
      },
      {
        "name": "VaultUpdated",
        "type": "contracts::protocol_registry::ProtocolRegistry::VaultUpdated",
        "kind": "nested"
      },
      {
        "name": "CoverageParamsUpdated",
        "type": "contracts::protocol_registry::ProtocolRegistry::CoverageParamsUpdated",
        "kind": "nested"
      }
    ]
  }
] as const;
