// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract CertificateRegistry is Ownable {
    struct Certificate { bytes32 documentHash; address issuer; uint64 issuedAt; bool revoked; string cid; }
    mapping(bytes32 => Certificate) private certificates;
    mapping(address => bool) public authorizedUploaders;

    event CertificateIssued(bytes32 indexed certificateId, bytes32 indexed documentHash, address indexed issuer, string cid);
    event CertificateRevoked(bytes32 indexed certificateId, address indexed revokedBy);
    event UploaderAuthorized(address indexed uploader);
    event UploaderRemoved(address indexed uploader);

    constructor(address initialOwner) Ownable(initialOwner) {}
    modifier onlyUploader() { require(authorizedUploaders[msg.sender] || msg.sender == owner(), "Uploader not authorized"); _; }

    function setUploader(address uploader, bool allowed) external onlyOwner {
        require(uploader != address(0), "Zero address");
        authorizedUploaders[uploader] = allowed;
        if (allowed) emit UploaderAuthorized(uploader); else emit UploaderRemoved(uploader);
    }
    function issueCertificate(bytes32 certificateId, bytes32 documentHash, string calldata cid) external onlyUploader {
        require(certificates[certificateId].issuedAt == 0, "Certificate exists");
        require(documentHash != bytes32(0), "Empty hash");
        certificates[certificateId] = Certificate(documentHash, msg.sender, uint64(block.timestamp), false, cid);
        emit CertificateIssued(certificateId, documentHash, msg.sender, cid);
    }
    function revokeCertificate(bytes32 certificateId) external {
        Certificate storage certificate = certificates[certificateId];
        require(certificate.issuedAt != 0, "Certificate not found");
        require(msg.sender == owner() || msg.sender == certificate.issuer, "Not permitted");
        require(!certificate.revoked, "Already revoked");
        certificate.revoked = true;
        emit CertificateRevoked(certificateId, msg.sender);
    }
    function getCertificate(bytes32 certificateId) external view returns (Certificate memory) { return certificates[certificateId]; }
    function certificateExists(bytes32 certificateId) external view returns (bool) { return certificates[certificateId].issuedAt != 0; }
}
