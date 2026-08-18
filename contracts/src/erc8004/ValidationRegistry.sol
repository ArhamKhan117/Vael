// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IIdentityRegistryMinimal {
    function isActive(uint256 agentId) external view returns (bool);
}

/**
 * @title ValidationRegistry
 * @notice Records third-party validation results for agent outputs as described in ERC-8004.
 */
contract ValidationRegistry is Ownable {
    enum ValidationMethod {
        Unknown,
        TEE,
        ZKML,
        StakeReexecution,
        ManualAudit
    }

    struct ValidationRecord {
        uint256 questId;
        uint256 agentId;
        address validator;
        ValidationMethod method;
        string evidenceURI; // pointer to proof artifact (e.g. attestation, zk proof)
        bool valid;
        uint256 timestamp;
    }

    ValidationRecord[] private _records;
    mapping(uint256 questId => uint256[]) private _recordsByQuest;

    mapping(address => bool) private _authorizedValidators;
    IIdentityRegistryMinimal public immutable IDENTITY_REGISTRY;

    event ValidatorAuthorizationChanged(address indexed validator, bool authorized);
    event ValidationRecorded(
        uint256 indexed recordId,
        uint256 indexed questId,
        uint256 indexed agentId,
        address validator,
        ValidationMethod method,
        bool valid
    );

    error ValidationRegistry__Unauthorized(address validator);
    error ValidationRegistry__AgentInactive(uint256 agentId);

    constructor(address owner_, IIdentityRegistryMinimal identityRegistry_) Ownable(owner_) {
        IDENTITY_REGISTRY = identityRegistry_;
    }

    function setValidatorAuthorization(address validator, bool authorized) external onlyOwner {
        _authorizedValidators[validator] = authorized;
        emit ValidatorAuthorizationChanged(validator, authorized);
    }

    function isValidatorAuthorized(address validator) external view returns (bool) {
        return _authorizedValidators[validator];
    }

    function recordValidation(
        uint256 questId,
        uint256 agentId,
        ValidationMethod method,
        string calldata evidenceURI,
        bool valid
    ) external returns (uint256 recordId) {
        if (!_authorizedValidators[msg.sender]) {
            revert ValidationRegistry__Unauthorized(msg.sender);
        }
        if (!IDENTITY_REGISTRY.isActive(agentId)) revert ValidationRegistry__AgentInactive(agentId);

        ValidationRecord memory record = ValidationRecord({
            questId: questId,
            agentId: agentId,
            validator: msg.sender,
            method: method,
            evidenceURI: evidenceURI,
            valid: valid,
            timestamp: block.timestamp
        });

        _records.push(record);
        recordId = _records.length - 1;
        _recordsByQuest[questId].push(recordId);

        emit ValidationRecorded(recordId, questId, agentId, msg.sender, method, valid);
    }

    function getValidationRecord(uint256 recordId) external view returns (ValidationRecord memory) {
        require(recordId < _records.length, "ValidationRegistry: invalid recordId");
        return _records[recordId];
    }

    function getQuestValidationRecords(uint256 questId) external view returns (uint256[] memory) {
        return _recordsByQuest[questId];
    }

    function totalRecords() external view returns (uint256) {
        return _records.length;
    }
}
