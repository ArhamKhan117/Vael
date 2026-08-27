// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IEquipment
/// @notice The stat bonuses a hero's equipped items contribute.
/// @dev Kept to one read so a module that wants bonuses does not have to know how equipment is
/// stored, and so Arena can be deployed before Equipment exists and pointed at it afterwards.
interface IEquipment {
    /// @notice Total bonuses across every slot a hero has filled.
    /// @param heroTokenId The hero's VaelHero token id.
    /// @return strength Added strength.
    /// @return agility Added agility.
    /// @return intellect Added intellect.
    function bonusesOf(uint256 heroTokenId)
        external
        view
        returns (uint16 strength, uint16 agility, uint16 intellect);
}
